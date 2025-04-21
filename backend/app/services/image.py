"""
图像生成服务模块

该模块提供图像生成服务，只负责单张图片生成的相关逻辑。
使用环境变量中的NIETA_XTOKEN进行API认证。
"""

from typing import Dict, Any, List, Optional, Tuple
import logging
import random
import httpx
import json
import os
import time
import asyncio
from datetime import datetime

from app.core.config import settings

# 配置日志
logger = logging.getLogger(__name__)

class ImageGenerationService:
    """图像生成服务"""

    def __init__(self):
        """初始化图像生成服务"""
        # 使用环境变量中的NIETA_XTOKEN
        self.x_token = os.environ.get("NIETA_XTOKEN", "")
        if not self.x_token:
            raise ValueError("环境变量中未设置NIETA_XTOKEN")

        # API端点
        self.api_url = "https://api.talesofai.cn/v3/make_image"
        self.task_status_url = "https://api.talesofai.cn/v1/artifact/task/{task_uuid}"

        # 轮询配置
        self.max_polling_attempts = int(os.environ.get("IMAGE_MAX_POLLING_ATTEMPTS", "30"))  # 最大轮询次数
        self.polling_interval = float(os.environ.get("IMAGE_POLLING_INTERVAL", "2.0"))  # 轮询间隔（秒）

        # 默认请求头
        self.default_headers = {
            "Content-Type": "application/json",
            "x-token": self.x_token,
            "x-channel-from": "none",
            "x-nieta-app-version": "5.10.11",
            "x-platform": "nieta-app/web"
        }

    async def calculate_dimensions(self, ratio: str) -> Tuple[int, int]:
        """
        根据比例计算宽高

        Args:
            ratio: 比例字符串，如"1:1"、"4:3"等

        Returns:
            宽度和高度
        """
        default_width = 512
        default_height = 512

        parts = ratio.split(":")
        if len(parts) == 2:
            width_ratio = float(parts[0])
            height_ratio = float(parts[1])

            # 计算宽高
            if width_ratio > height_ratio:
                width = default_width
                height = int(default_width * height_ratio / width_ratio)
            else:
                height = default_height
                width = int(default_height * width_ratio / height_ratio)

            # 确保宽高是8的倍数
            width = (width // 8) * 8
            height = (height // 8) * 8

            return width, height

    # ===== 核心图像生成功能 =====

    async def generate_image(
        self,
        prompts: List[Dict[str, Any]],
        width: int,
        height: int,
        seed: Optional[int] = None,
        advanced_translator: bool = False
    ) -> Dict[str, Any]:
        """
        生成图像

        Args:
            prompts: 格式化后的提示词列表
            width: 图像宽度
            height: 图像高度
            seed: 随机种子，如果为None则自动生成
            advanced_translator: 是否使用高级翻译

        Returns:
            图像生成结果
        """
        if seed is None:
            seed = random.randint(1, 2147483647)

        payload = {
            "storyId": "",
            "jobType": "universal",
            "width": width,
            "height": height,
            "rawPrompt": prompts,
            "seed": seed,
            "meta": {"entrance": "PICTURE,PURE"},
            "context_model_series": None,
            "negative_freetext": "",
            "advanced_translator": advanced_translator
        }

        # 发送API请求获取任务ID
        task_response = await self._send_api_request(payload)

        # 提取任务UUID
        task_uuid = self._extract_task_uuid(task_response)
        if not task_uuid:
            raise Exception("无法获取任务UUID")

        logger.info(f"获取到图像任务UUID: {task_uuid}")

        # 轮询任务状态直到完成
        task_result = await self._poll_task_status(task_uuid)

        # 构建结果
        result = {
            "data": {
                "task_uuid": task_uuid,
                "width": width,
                "height": height,
                "seed": seed
            }
        }

        # 如果有图像结果，添加图像 URL
        if task_result and task_result.get("task_status") == "SUCCESS" and task_result.get("artifacts"):
            for artifact in task_result.get("artifacts", []):
                if artifact.get("url"):
                    result["data"]["image_url"] = artifact.get("url")
                    break

        return result

    async def extract_image_url(self, result: Dict[str, Any]) -> str:
        """
        从结果中提取图像URL

        Args:
            result: 图像生成结果

        Returns:
            图像URL
        """
        # 处理新的轮询响应格式
        if "artifacts" in result and isinstance(result["artifacts"], list) and len(result["artifacts"]) > 0:
            for artifact in result["artifacts"]:
                if isinstance(artifact, dict) and "url" in artifact and artifact.get("status") == "SUCCESS":
                    return artifact["url"]

        # 如果数据已经包含在data字段中
        if "data" in result and isinstance(result["data"], dict) and "image_url" in result["data"]:
            return result["data"]["image_url"]

        # 输出完整的响应以便调试
        logger.debug(f"完整的API响应: {json.dumps(result, ensure_ascii=False)}")
        return ""

    # ===== 内部辅助方法 =====

    def _extract_task_uuid(self, response: Dict[str, Any]) -> Optional[str]:
        """
        从响应中提取任务UUID

        Args:
            response: API响应

        Returns:
            任务UUID，如果不存在则返回None
        """
        # 直接返回的UUID字符串
        if isinstance(response, str) and len(response) > 30 and "-" in response:
            return response.strip()

        # 如果是字典类型的响应
        if isinstance(response, dict):
            # 检查常见的UUID字段
            for key in ["uuid", "task_uuid", "id", "task_id"]:
                if key in response and isinstance(response[key], str):
                    return response[key]

            # 检查data字段
            if "data" in response and isinstance(response["data"], dict):
                for key in ["uuid", "task_uuid", "id", "task_id"]:
                    if key in response["data"] and isinstance(response["data"][key], str):
                        return response["data"][key]

        logger.warning(f"无法从响应中提取任务UUID: {json.dumps(response, ensure_ascii=False)}")
        return None

    async def _poll_task_status(self, task_uuid: str) -> Optional[Dict[str, Any]]:
        """
        轮询任务状态直到完成

        Args:
            task_uuid: 任务UUID

        Returns:
            任务结果，如果超时则返回None
        """
        status_url = self.task_status_url.format(task_uuid=task_uuid)
        logger.info(f"开始轮询任务状态: {status_url}")

        for attempt in range(self.max_polling_attempts):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(
                        status_url,
                        headers=self.default_headers
                    )

                    # 检查响应状态
                    response.raise_for_status()

                    # 解析响应数据
                    result = response.json()
                    task_status = result.get("task_status")

                    logger.debug(f"轮询任务状态 (第{attempt+1}次): {task_status}")

                    # 如果任务完成或失败，返回结果
                    if task_status in ["SUCCESS", "FAILED", "ERROR", "TIMEOUT"]:
                        logger.info(f"任务完成，状态: {task_status}")
                        return result

                    # 如果任务仍在进行中，等待一段时间后再次轮询
                    await asyncio.sleep(self.polling_interval)

            except Exception as e:
                logger.error(f"轮询任务状态时出错: {str(e)}")
                # 出错后等待一段时间再重试
                await asyncio.sleep(self.polling_interval)

        # 超过最大轮询次数仍未完成
        logger.warning(f"轮询任务状态超时: {task_uuid}")
        return None

    async def _send_api_request(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        发送API请求

        Args:
            payload: 请求数据

        Returns:
            API响应
        """
        try:
            logger.info(f"调用图像生成API: {json.dumps(payload, ensure_ascii=False)}")

            # 发送API请求
            async with httpx.AsyncClient(timeout=300.0) as client:  # 5分钟超时
                response = await client.post(
                    self.api_url,
                    json=payload,
                    headers=self.default_headers
                )

                # 检查响应状态
                response.raise_for_status()

                # 解析响应数据
                result = response.json()
                logger.info(f"图像生成请求成功: {result}")

                return result

        except httpx.HTTPStatusError as e:
            error_msg = f"图像生成API返回错误状态码: {e.response.status_code}"
            logger.error(error_msg)
            try:
                error_data = e.response.json()
                logger.error(f"错误详情: {error_data}")
            except:
                pass
            raise Exception(error_msg)

        except httpx.RequestError as e:
            error_msg = f"请求图像生成API时出错: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)

        except Exception as e:
            error_msg = f"生成图像时出错: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)

# ===== 工具函数 =====
def format_prompt_for_api(prompt_data: Any, prompt_type: str) -> Dict[str, Any]:
    """
    将提示词、角色或元素数据转换为标准API格式

    Args:
        prompt_data: 提示词、角色或元素数据
        prompt_type: 指定类型，可以是'prompt'/'character'/'element'

    Returns:
        标准格式的提示词数据
    """
    # 确保prompt_type符合要求
    if prompt_type not in [None, "prompt", "character", "element"]:
        raise ValueError("prompt_type必须是'prompt'/'character'/'element'中的一个")

    # 初始化结果字典
    result = {}

    # 如果是字符串，则创建一个freetext类型的提示词
    if isinstance(prompt_data, str):
        return {
            "type": "freetext",
            "weight": 1,
            "value": prompt_data
        }

    # 如果不是字典，报错
    if type(prompt_data) != dict:
        raise TypeError("提示词数据必须是字符串或字典")

    # 如果是提示词类型，使用freetext类型
    if prompt_type == "prompt":
        return {
            "type": "freetext",
            "weight": prompt_data.get("weight", 1),
            "value": prompt_data.get("value", "")
        }

    # 如果是角色或元素类型
    # 首先检查是否有必要的字段
    if "uuid" not in prompt_data:
        # 如果有value字段，使用它作为uuid
        if "value" in prompt_data:
            prompt_data["uuid"] = prompt_data["value"]
        else:
            raise KeyError("提示词数据缺少uuid字段")

    if "name" not in prompt_data:
        logger.warning(f"提示词数据缺少name字段: {prompt_data}")
        # 返回一个默认的freetext类型
        return {
            "type": "freetext",
            "weight": prompt_data.get("weight", 1),
            "value": prompt_data.get("uuid", "")
        }

    # 根据prompt_type或prompt_data["type"]决定类型
    is_character = False
    if prompt_type == "character":
        is_character = True
    elif "type" in prompt_data and prompt_data["type"] == "character":
        is_character = True

    result["type"] = "oc_vtoken_adaptor" if is_character else "elementum"
    result["uuid"] = prompt_data["uuid"]
    result["value"] = prompt_data["uuid"]  # value与uuid相同
    result["name"] = prompt_data["name"]
    result["weight"] = prompt_data.get("weight", 1)
    result["img_url"] = prompt_data.get("header_url", "")
    result["domain"] = ""
    result["parent"] = ""
    result["label"] = None
    result["sort_index"] = 0
    result["status"] = "IN_USE"
    result["polymorphi_values"] = {}
    result["sub_type"] = None

    return result

# 创建图像生成服务实例
def create_image_generator() -> ImageGenerationService:
    """
    创建图像生成服务实例

    Returns:
        图像生成服务实例
    """
    return ImageGenerationService()
