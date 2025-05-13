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

        # Lumina API端点
        self.lumina_api_url = "https://ops.api.talesofai.cn/v3/make_image"
        self.lumina_task_status_url = "https://ops.api.talesofai.cn/v1/artifact/task/{task_uuid}"

        # 轮询配置
        self.max_polling_attempts = settings.IMAGE_MAX_POLLING_ATTEMPTS  # 最大轮询次数
        self.polling_interval = settings.IMAGE_POLLING_INTERVAL  # 轮询间隔（秒）

        # Lumina轮询配置
        self.lumina_max_polling_attempts = settings.LUMINA_MAX_POLLING_ATTEMPTS  # Lumina最大轮询次数
        self.lumina_polling_interval = settings.LUMINA_POLLING_INTERVAL  # Lumina轮询间隔（秒）

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
        target_pixels = 1024 * 1024

        parts = ratio.split(":")
        if len(parts) == 2:
            try:
                width_ratio = float(parts[0])
                height_ratio = float(parts[1])
                x = math.sqrt(target_pixels / (width_ratio * height_ratio))
                width = width_ratio * x
                height = height_ratio * x
                width = round(width / 8) * 8
                height = round(height / 8) * 8
                return int(width), int(height)
            except Exception as e:
                logger.warning(f"计算比例 {ratio} 的尺寸时出错: {str(e)}")

        return 1024, 1024

    # ===== 核心图像生成功能 =====

    async def generate_image(
        self,
        prompts: List[Dict[str, Any]],
        width: int,
        height: int,
        seed: Optional[int] = None,
        advanced_translator: bool = False,
        client_args: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        生成图像

        Args:
            prompts: 格式化后的提示词列表
            width: 图像宽度
            height: 图像高度
            seed: 随机种子，如果为None则自动生成
            advanced_translator: 是否使用高级翻译
            client_args: 客户端参数，仅当存在lumina1元素时使用

        Returns:
            图像生成结果
        """
        if seed is None:
            seed = random.randint(1, 2147483647)

        # 检查是否包含lumina关键字
        use_lumina = False
        has_lumina1 = False
        for prompt in prompts:
            if isinstance(prompt, dict) and "name" in prompt and "lumina" in prompt["name"].lower():
                use_lumina = True
                logger.debug(f"检测到prompt中包含lumina关键字，将使用Lumina API端点")
                # 检查是否是lumina1
                if prompt.get("name") == "lumina1":
                    has_lumina1 = True
                    logger.debug(f"检测到prompt中包含lumina1元素")
                break

        # 选择API端点
        api_url = self.lumina_api_url if use_lumina else self.api_url
        task_status_url = self.lumina_task_status_url if use_lumina else self.task_status_url

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

        # 如果存在lumina1元素且提供了client_args，添加到请求中
        if has_lumina1 and client_args:
            logger.debug(f"检测到lumina1元素，添加client_args参数: {client_args}")
            payload["client_args"] = client_args

        # 记录请求载荷基本信息
        logger.info(f"请求载荷: {json.dumps(payload, ensure_ascii=False)}")

        # 发送API请求获取任务ID
        task_response = await self._send_api_request(payload, api_url)

        # 提取任务UUID
        task_uuid = self._extract_task_uuid(task_response)
        if not task_uuid:
            raise Exception("无法获取任务UUID")

        logger.info(f"获取到图像任务UUID: {task_uuid}")

        # 轮询任务状态直到完成
        logger.info(f"开始轮询任务状态: {task_uuid}")
        try:
            task_result = await self._poll_task_status(task_uuid, task_status_url)
            if task_result:
                # 安全地获取URL，避免索引错误
                artifacts = task_result.get('artifacts', [])
                url = artifacts[0].get('url') if artifacts else None
                logger.info(f"轮询任务状态完成: {task_uuid}, 状态: {task_result.get('task_status')}, url: {url}")
                logger.info(f"轮询任务结果: {json.dumps(task_result, ensure_ascii=False)}")
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

        # 如果任务结果存在，将任务状态添加到结果中
        if task_result:
            task_status = task_result.get("task_status")
            # 将任务状态添加到结果中，以便task_processor.py可以检测到TIMEOUT状态
            result["task_status"] = task_status

            # 如果有图像结果且状态为SUCCESS，添加图像URL
            if task_status == "SUCCESS" and task_result.get("artifacts"):
                for artifact in task_result.get("artifacts", []):
                    if artifact.get("url"):
                        result["data"]["image_url"] = artifact.get("url")
                        break
                logger.info(f"任务状态为SUCCESS，添加图像URL: {result['data']['image_url']}")

            # 如果状态为TIMEOUT，记录日志
            elif task_status == "TIMEOUT":
                logger.warning(f"任务状态为TIMEOUT: {task_uuid}，将通知task_processor进行重试")

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

    async def _poll_task_status(self, task_uuid: str, task_status_url: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        轮询任务状态直到完成

        Args:
            task_uuid: 任务UUID
            task_status_url: 任务状态URL模板，如果为None则使用默认值

        Returns:
            任务结果，如果超时则返回None
        """
        # 如果未提供task_status_url，使用默认值
        if task_status_url is None:
            task_status_url = self.task_status_url

        # 根据任务URL判断是否是Lumina任务
        is_lumina_task = "ops.api.talesofai.cn" in task_status_url

        # 根据任务类型选择轮询配置
        max_attempts = self.lumina_max_polling_attempts if is_lumina_task else self.max_polling_attempts
        polling_interval = self.lumina_polling_interval if is_lumina_task else self.polling_interval

        # 记录任务类型和轮询配置
        task_type = "Lumina" if is_lumina_task else "标准"
        logger.debug(f"开始轮询{task_type}任务状态: {task_uuid}, 最大轮询次数: {max_attempts}, 轮询间隔: {polling_interval}秒")

        status_url = task_status_url.format(task_uuid=task_uuid)
        logger.info(f"开始轮询任务状态: {status_url}")
        start_time = time.time()

        for attempt in range(max_attempts):
            try:
                elapsed_time = time.time() - start_time
                logger.info(f"轮询任务状态 (第{attempt+1}/{max_attempts}次), 已耗时: {elapsed_time:.2f}秒, 任务ID: {task_uuid}")

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
                    if attempt % 3 == 0 or task_status != "PENDING":
                        logger.info(f"轮询状态 (第{attempt+1}次): {task_status}, artifacts={artifacts_count}, 任务ID: {task_uuid}")

                    # 如果任务状态是PENDING，继续轮询
                    if task_status == "PENDING":
                        # 任务仍在进行中，等待一段时间后再次轮询
                        await asyncio.sleep(polling_interval)
                    # 如果任务状态是SUCCESS但artifacts列表为空，继续轮询（最多2次）
                    elif task_status == "SUCCESS" and not result.get('artifacts') and attempt < 2:
                        logger.warning(f"任务状态为SUCCESS但artifacts列表为空，继续轮询 (第{attempt+1}次), 任务ID: {task_uuid}")
                        await asyncio.sleep(polling_interval)
                    else:
                        # 任务已完成或失败，返回结果
                        # 如果状态不在预期列表中，记录警告
                        if task_status not in ["SUCCESS", "FAILED", "ERROR", "TIMEOUT", "ILLEGAL_IMAGE", "FAILURE"]:
                            logger.warning(f"任务状态不在预期列表中: {task_status}，将视为FAILURE处理, 任务ID: {task_uuid}")
                            result["task_status"] = "FAILURE"  # 将未预期的状态视为FAILURE

                        total_time = time.time() - start_time
                        logger.info(f"任务完成，状态: {task_status}, 总耗时: {total_time:.2f}秒, 任务ID: {task_uuid}, 结果: {json.dumps(result, ensure_ascii=False)}")
                        return result

            except Exception as e:
                logger.error(f"轮询任务状态时出错 (第{attempt+1}次): {str(e)}, 任务ID: {task_uuid}")
                # 打印异常堆栈
                import traceback
                logger.error(f"轮询异常堆栈 (第{attempt+1}次):\n{traceback.format_exc()}")
                # 出错后等待一段时间再重试
                await asyncio.sleep(polling_interval)

        # 超过最大轮询次数仍未完成
        total_time = time.time() - start_time
        logger.warning(f"轮询{task_type}任务状态超时: {task_uuid}, 总耗时: {total_time:.2f}秒, 尝试次数: {max_attempts}")
        return None

    async def _send_api_request(self, payload: Dict[str, Any], api_url: Optional[str] = None) -> Dict[str, Any]:
        """
        发送API请求

        Args:
            payload: 请求数据
            api_url: API端点URL，如果为None则使用默认值

        Returns:
            API响应
        """
        # 如果未提供api_url，使用默认值
        if api_url is None:
            api_url = self.api_url

        # 提取任务标识信息，用于日志
        task_info = ""
        if "rawPrompt" in payload and isinstance(payload["rawPrompt"], list):
            for prompt in payload["rawPrompt"]:
                if isinstance(prompt, dict) and prompt.get("type") == "oc_vtoken_adaptor" and "name" in prompt:
                    task_info = f"[角色: {prompt.get('name')}]"
                    break

        start_time = time.time()
        logger.debug(f"开始调用图像生成API {task_info}: {json.dumps(payload, ensure_ascii=False)}")
        logger.debug(f"使用API端点: {api_url}")

        try:
            # 发送API请求
            async with httpx.AsyncClient(timeout=300.0) as client:  # 5分钟超时
                response = await client.post(
                    api_url,
                    json=payload,
                    headers=self.default_headers
                )

                # 检查响应状态
                response.raise_for_status()

                # 解析响应数据
                result = response.json()
                elapsed_time = time.time() - start_time
                logger.debug(f"图像生成API请求成功 {task_info}, 耗时: {elapsed_time:.2f}秒")
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

# 创建图像生成服务实例
def create_image_generator() -> ImageGenerationService:
    """
    创建图像生成服务实例

    Returns:
        图像生成服务实例
    """
    return ImageGenerationService()
