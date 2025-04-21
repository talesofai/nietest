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
import math
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
        self.max_polling_attempts = int(os.environ.get("IMAGE_MAX_POLLING_ATTEMPTS", "15"))  # 最大轮询次数，默认15次
        self.polling_interval = float(os.environ.get("IMAGE_POLLING_INTERVAL", "1.0"))  # 轮询间隔（秒），默认1秒

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
        根据比例计算宽高，确保总像素数接近 1024²

        Args:
            ratio: 比例字符串，如"1:1"、"4:3"等

        Returns:
            宽度和高度
        """
        # 目标总像素数
        target_pixels = 1024 * 1024

        # 如果是其他比例，计算宽高
        parts = ratio.split(":")
        if len(parts) == 2:
            width_ratio = float(parts[0])
            height_ratio = float(parts[1])

            # 计算比例因子
            ratio_factor = width_ratio / height_ratio

            # 计算宽高，保持总像素数接近目标值
            height = int(math.sqrt(target_pixels / ratio_factor))
            width = int(height * ratio_factor)

            # 确保宽高是8的倍数
            width = (width // 8) * 8
            height = (height // 8) * 8

            # 确保宽高不超过1024
            if width > 1024:
                width = 1024
                height = int(width / ratio_factor)
                height = (height // 8) * 8
            elif height > 1024:
                height = 1024
                width = int(height * ratio_factor)
                width = (width // 8) * 8

            # 记录计算结果
            logger.info(f"根据比例 {ratio} 计算宽高: {width}x{height}, 总像素数: {width*height}")
            return width, height

        # 如果比例格式不正确，返回默认宽高
        logger.warning(f"比例格式不正确: {ratio}，使用默认宽高: 1024x1024")
        return 1024, 1024

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

        # 构建请求载荷
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

        # 记录请求载荷基本信息
        logger.info(f"请求载荷结构: width={width}, height={height}, seed={seed}, advanced_translator={advanced_translator}, 提示词数量: {len(prompts)}")

        # 发送API请求获取任务ID
        task_response = await self._send_api_request(payload)

        # 提取任务UUID
        task_uuid = self._extract_task_uuid(task_response)
        if not task_uuid:
            raise Exception("无法获取任务UUID")

        logger.info(f"获取到图像任务UUID: {task_uuid}")

        # 轮询任务状态直到完成
        logger.info(f"开始轮询任务状态: {task_uuid}")
        try:
            task_result = await self._poll_task_status(task_uuid)
            if task_result:
                logger.info(f"轮询任务状态完成: {task_uuid}, 状态: {task_result.get('task_status')}")
                logger.debug(f"轮询任务结果: {json.dumps(task_result, ensure_ascii=False)}")
            else:
                logger.warning(f"轮询任务状态超时: {task_uuid}, 未能获取结果")
        except Exception as e:
            logger.error(f"轮询任务状态失败: {task_uuid}, 错误: {str(e)}")
            # 打印异常堆栈
            import traceback
            logger.error(f"轮询异常堆栈:\n{traceback.format_exc()}")
            raise

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
        logger.debug(f"开始从结果中提取图像URL")

        # 输出完整的响应以便调试
        logger.debug(f"完整的API响应类型: {type(result)}, 包含字段: {list(result.keys()) if isinstance(result, dict) else 'not a dict'}")

        # 处理新的轮询响应格式
        if "artifacts" in result and isinstance(result["artifacts"], list) and len(result["artifacts"]) > 0:
            logger.debug(f"发现artifacts字段，包含 {len(result['artifacts'])} 个项目")
            for i, artifact in enumerate(result["artifacts"]):
                if isinstance(artifact, dict) and "url" in artifact and artifact.get("status") == "SUCCESS":
                    logger.debug(f"从 artifacts[{i}] 中提取到URL: {artifact['url'][:50]}...")
                    return artifact["url"]

        # 如果数据已经包含在data字段中
        if "data" in result and isinstance(result["data"], dict):
            if "image_url" in result["data"]:
                logger.debug(f"从 data 字段中提取到URL: {result['data']['image_url'][:50]}...")
                return result["data"]["image_url"]

        logger.warning(f"无法从结果中提取图像URL")
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
        logger.debug(f"开始轮询任务状态: {status_url}")
        start_time = time.time()

        for attempt in range(self.max_polling_attempts):
            try:
                elapsed_time = time.time() - start_time
                logger.debug(f"轮询任务状态 (第{attempt+1}/{self.max_polling_attempts}次), 已耗时: {elapsed_time:.2f}秒, 任务ID: {task_uuid}")

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
                    artifacts_count = len(result.get('artifacts', []))

                    # 记录轮询结果，但减少日志量
                    if attempt % 3 == 0 or task_status in ["SUCCESS", "FAILED", "ERROR", "TIMEOUT"]:
                        logger.debug(f"轮询状态 (第{attempt+1}次): {task_status}, artifacts={artifacts_count}, 任务ID: {task_uuid}")

                    # 如果任务完成或失败，返回结果
                    if task_status in ["SUCCESS", "FAILED", "ERROR", "TIMEOUT"]:
                        total_time = time.time() - start_time
                        logger.info(f"任务完成，状态: {task_status}, 总耗时: {total_time:.2f}秒, 任务ID: {task_uuid}")
                        return result

                    # 如果任务仍在进行中，等待一段时间后再次轮询
                    await asyncio.sleep(self.polling_interval)

            except Exception as e:
                logger.error(f"轮询任务状态时出错 (第{attempt+1}次): {str(e)}, 任务ID: {task_uuid}")
                # 打印异常堆栈
                import traceback
                logger.error(f"轮询异常堆栈 (第{attempt+1}次):\n{traceback.format_exc()}")
                # 出错后等待一段时间再重试
                await asyncio.sleep(self.polling_interval)

        # 超过最大轮询次数仍未完成
        total_time = time.time() - start_time
        logger.warning(f"轮询任务状态超时: {task_uuid}, 总耗时: {total_time:.2f}秒, 尝试次数: {self.max_polling_attempts}")
        return None

    async def _send_api_request(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        发送API请求

        Args:
            payload: 请求数据

        Returns:
            API响应
        """
        # 提取任务标识信息，用于日志
        task_info = ""
        if "rawPrompt" in payload and isinstance(payload["rawPrompt"], list):
            for prompt in payload["rawPrompt"]:
                if isinstance(prompt, dict) and prompt.get("type") == "oc_vtoken_adaptor" and "name" in prompt:
                    task_info = f"[角色: {prompt.get('name')}]"
                    break

        start_time = time.time()
        logger.info(f"开始调用图像生成API {task_info}: {json.dumps(payload, ensure_ascii=False)}")

        try:
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
                elapsed_time = time.time() - start_time
                logger.info(f"图像生成API请求成功 {task_info}, 耗时: {elapsed_time:.2f}秒")
                logger.debug(f"图像生成API响应: {json.dumps(result, ensure_ascii=False)}")

                return result

        except httpx.HTTPStatusError as e:
            elapsed_time = time.time() - start_time
            error_msg = f"图像生成API返回错误状态码 {task_info}: {e.response.status_code}, 耗时: {elapsed_time:.2f}秒"
            logger.error(error_msg)
            try:
                error_data = e.response.json()
                logger.error(f"错误详情 {task_info}: {error_data}")
            except Exception as json_error:
                logger.error(f"无法解析错误响应 {task_info}: {str(json_error)}")
                try:
                    logger.error(f"原始响应内容 {task_info}: {e.response.text}")
                except:
                    pass
            raise Exception(error_msg)

        except httpx.RequestError as e:
            elapsed_time = time.time() - start_time
            error_msg = f"请求图像生成API时出错 {task_info}: {str(e)}, 耗时: {elapsed_time:.2f}秒"
            logger.error(error_msg)
            raise Exception(error_msg)

        except Exception as e:
            elapsed_time = time.time() - start_time
            error_msg = f"生成图像时出错 {task_info}: {str(e)}, 耗时: {elapsed_time:.2f}秒"
            logger.error(error_msg)
            # 打印异常堆栈
            import traceback
            logger.error(f"异常堆栈 {task_info}:\n{traceback.format_exc()}")
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
    # 记录输入参数
    logger.debug(f"格式化提示词输入: prompt_type={prompt_type}, prompt_data={json.dumps(prompt_data) if isinstance(prompt_data, (dict, list)) else prompt_data}")

    # 确保prompt_type符合要求
    if prompt_type not in [None, "prompt", "character", "element"]:
        raise ValueError("prompt_type必须是'prompt'/'character'/'element'中的一个")

    # 初始化结果字典
    result = {}

    # 如果是字符串，则创建一个freetext类型的提示词
    if isinstance(prompt_data, str):
        result = {
            "type": "freetext",
            "weight": 1,
            "value": prompt_data
        }
        logger.debug(f"字符串提示词格式化结果: {json.dumps(result)}")
        return result

    # 如果不是字典，报错
    if not isinstance(prompt_data, dict):
        raise TypeError(f"提示词数据必须是字符串或字典，当前类型: {type(prompt_data)}")

    # 如果是提示词类型，使用freetext类型
    if prompt_type == "prompt":
        result = {
            "type": "freetext",
            "weight": prompt_data.get("weight", 1),
            "value": prompt_data.get("value", "")
        }
        logger.debug(f"提示词格式化结果: {json.dumps(result)}")
        return result

    # 如果是角色或元素类型
    # 首先检查是否有必要的字段
    if "uuid" not in prompt_data:
        # 如果有value字段，使用它作为uuid
        if "value" in prompt_data:
            prompt_data["uuid"] = prompt_data["value"]
            logger.debug(f"从 value 字段复制 uuid: {prompt_data['value']}")
        else:
            error_msg = f"提示词数据缺少uuid字段: {json.dumps(prompt_data)}"
            logger.error(error_msg)
            raise KeyError(error_msg)

    if "name" not in prompt_data:
        logger.warning(f"提示词数据缺少name字段: {json.dumps(prompt_data)}")
        # 如果没有name字段，使用uuid作为name
        prompt_data["name"] = prompt_data.get("uuid", "")
        logger.debug(f"使用 uuid 作为 name: {prompt_data['name']}")

    # 根据prompt_type或prompt_data["type"]决定类型
    is_character = False
    if prompt_type == "character":
        is_character = True
        logger.debug(f"根据 prompt_type 确定为角色类型")
    elif "type" in prompt_data and prompt_data["type"] == "character":
        is_character = True
        logger.debug(f"根据 prompt_data['type'] 确定为角色类型")

    # 构建结果字典
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

    logger.debug(f"角色/元素格式化结果: {json.dumps(result)}")
    return result

# 创建图像生成服务实例
def create_image_generator() -> ImageGenerationService:
    """
    创建图像生成服务实例

    Returns:
        图像生成服务实例
    """
    return ImageGenerationService()
