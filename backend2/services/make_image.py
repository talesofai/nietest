"""
图像生成服务模块

该模块提供图像生成服务，负责单张图片生成的相关逻辑。
使用环境变量中的MAKE_API_TOKEN进行API认证。
"""

from typing import Dict, Any, List, Optional, Tuple
import logging
import random
import httpx
import json
import time
import asyncio
import math

from backend2.core.config import settings

# 配置日志
logger = logging.getLogger(__name__)

class MakeImageService:
    """图像生成服务"""

    def __init__(self):
        """初始化图像生成服务"""
        # 使用settings中的TEST_MAKE_API_TOKEN
        self.api_token = settings.TEST_MAKE_API_TOKEN
        if not self.api_token:
            raise ValueError("settings中未设置TEST_MAKE_API_TOKEN")

        # API端点
        self.api_url = "https://api.make.com/v1/generate"
        self.task_status_url = "https://api.make.com/v1/tasks/{task_uuid}"

        # 测试环境API端点
        self.dev_api_url = "https://dev.api.make.com/v1/generate"
        self.dev_task_status_url = "https://dev.api.make.com/v1/tasks/{task_uuid}"

        # 运维环境API端点
        self.ops_api_url = "https://ops.api.make.com/v1/generate"
        self.ops_task_status_url = "https://ops.api.make.com/v1/tasks/{task_uuid}"

        # 轮询配置
        self.max_polling_attempts = settings.TEST_IMAGE_MAX_POLLING_ATTEMPTS  # 最大轮询次数
        self.polling_interval = settings.TEST_IMAGE_POLLING_INTERVAL    # 轮询间隔（秒）

        # 默认请求头
        self.default_headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_token}",
            "X-Client-Version": "1.0.0",
            "X-Client-Platform": "backend"
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
                width = round(width / 8) * 8  # 确保是8的倍数
                height = round(height / 8) * 8  # 确保是8的倍数
                return int(width), int(height)
            except Exception as e:
                logger.warning(f"计算比例 {ratio} 的尺寸时出错: {str(e)}")

        # 默认返回1:1比例
        return 1024, 1024

    # ===== 核心图像生成功能 =====

    async def generate_image(
        self,
        prompts: List[Dict[str, Any]],
        ratio: str = "1:1",
        seed: Optional[int] = None,
        queue_type: str = ""
    ) -> Dict[str, Any]:
        """
        生成图像

        Args:
            prompts: 提示词列表
            ratio: 图像比例，如"1:1"、"16:9"等
            seed: 随机种子，如果为None则自动生成
            queue_type: API队列类型，可选值为""(默认生产环境)、"dev"(开发环境)、"ops"(运维环境)

        Returns:
            图像生成结果
        """
        # 计算宽高
        width, height = await self.calculate_dimensions(ratio)

        # 生成随机种子（如果未提供）
        if seed is None:
            seed = random.randint(1, 2147483647)

        # 根据队列类型选择API端点
        api_url, task_status_url = self._select_api_endpoints(queue_type)

        # 构建请求载荷
        payload = {
            "prompts": prompts,
            "width": width,
            "height": height,
            "seed": seed,
            "batch_size": 1,
            "quality": "standard"
        }

        # 记录请求载荷基本信息
        logger.info(f"图像生成请求: 宽度={width}, 高度={height}, 种子={seed}, 队列={queue_type}")
        logger.debug(f"完整请求载荷: {json.dumps(payload, ensure_ascii=False)}")

        # 发送API请求获取任务ID
        task_response = await self._send_api_request(payload, api_url)

        # 提取任务UUID
        task_uuid = self._extract_task_uuid(task_response)
        if not task_uuid:
            raise Exception("无法获取任务UUID")

        logger.debug(f"获取到图像任务UUID: {task_uuid}")

        # 轮询任务状态直到完成
        task_result = await self._poll_task_status(task_uuid, task_status_url)

        if not task_result:
            logger.warning(f"轮询任务状态超时: {task_uuid}")
            raise Exception("生成图像超时")

        logger.debug(f"轮询任务状态完成: {task_uuid}, 状态: {task_result.get('status')}")

        # 提取图像URL
        image_url = self._extract_image_url(task_result)
        if not image_url:
            logger.error(f"无法从任务结果中提取图像URL: {task_uuid}")
            raise Exception("无法获取生成的图像URL")

        # 构建结果
        result = {
            "task_uuid": task_uuid,
            "width": width,
            "height": height,
            "seed": seed,
            "image_url": image_url,
            "status": "success"
        }

        return result

    # ===== 内部辅助方法 =====

    def _select_api_endpoints(self, queue_type: str) -> Tuple[str, str]:
        """
        根据队列类型选择API端点

        Args:
            queue_type: API队列类型

        Returns:
            API URL和任务状态URL
        """
        if queue_type == "dev":
            return self.dev_api_url, self.dev_task_status_url
        elif queue_type == "ops":
            return self.ops_api_url, self.ops_task_status_url
        else:
            return self.api_url, self.task_status_url

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

    def _extract_image_url(self, task_result: Dict[str, Any]) -> str:
        """
        从任务结果中提取图像URL

        Args:
            task_result: 任务结果

        Returns:
            图像URL，如果不存在则返回空字符串
        """
        # 检查结果格式的各种可能路径
        if "url" in task_result:
            return task_result["url"]

        if "image_url" in task_result:
            return task_result["image_url"]

        if "data" in task_result and isinstance(task_result["data"], dict):
            if "url" in task_result["data"]:
                return task_result["data"]["url"]
            if "image_url" in task_result["data"]:
                return task_result["data"]["image_url"]

        if "images" in task_result and isinstance(task_result["images"], list) and len(task_result["images"]) > 0:
            if isinstance(task_result["images"][0], str):
                return task_result["images"][0]
            elif isinstance(task_result["images"][0], dict) and "url" in task_result["images"][0]:
                return task_result["images"][0]["url"]

        logger.warning(f"无法从任务结果中提取图像URL: {json.dumps(task_result, ensure_ascii=False)}")
        return ""

    async def _poll_task_status(self, task_uuid: str, task_status_url: str) -> Optional[Dict[str, Any]]:
        """
        轮询任务状态直到完成

        Args:
            task_uuid: 任务UUID
            task_status_url: 任务状态URL模板

        Returns:
            任务结果，如果超时则返回None
        """
        status_url = task_status_url.format(task_uuid=task_uuid)
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
                    status = result.get("status")

                    # 记录轮询结果
                    if attempt % 3 == 0 or status in ["completed", "success", "failed", "error", "timeout"]:
                        logger.debug(f"轮询状态 (第{attempt+1}次): {status}, 任务ID: {task_uuid}")

                    # 如果任务完成或失败，返回结果
                    if status in ["completed", "success", "failed", "error", "timeout"]:
                        total_time = time.time() - start_time
                        logger.debug(f"任务完成，状态: {status}, 总耗时: {total_time:.2f}秒, 任务ID: {task_uuid}")
                        return result

                    # 如果任务仍在进行中，等待一段时间后再次轮询
                    await asyncio.sleep(self.polling_interval)

            except Exception as e:
                logger.error(f"轮询任务状态时出错 (第{attempt+1}次): {str(e)}, 任务ID: {task_uuid}")
                # 出错后等待一段时间再重试
                await asyncio.sleep(self.polling_interval)

        # 超过最大轮询次数仍未完成
        total_time = time.time() - start_time
        logger.warning(f"轮询任务状态超时: {task_uuid}, 总耗时: {total_time:.2f}秒, 尝试次数: {self.max_polling_attempts}")
        return None

    async def _send_api_request(self, payload: Dict[str, Any], api_url: str) -> Dict[str, Any]:
        """
        发送API请求

        Args:
            payload: 请求数据
            api_url: API端点URL

        Returns:
            API响应
        """
        start_time = time.time()
        logger.debug(f"开始调用图像生成API: {api_url}")

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
                logger.debug(f"图像生成API请求成功, 耗时: {elapsed_time:.2f}秒")
                logger.debug(f"图像生成API响应: {json.dumps(result, ensure_ascii=False)}")

                return result

        except httpx.HTTPStatusError as e:
            elapsed_time = time.time() - start_time
            error_msg = f"图像生成API返回错误状态码: {e.response.status_code}, 耗时: {elapsed_time:.2f}秒"
            logger.error(error_msg)
            try:
                error_data = e.response.json()
                logger.error(f"错误详情: {error_data}")
            except Exception:
                logger.error(f"原始响应内容: {e.response.text}")
            raise Exception(error_msg)

        except httpx.RequestError as e:
            elapsed_time = time.time() - start_time
            error_msg = f"请求图像生成API时出错: {str(e)}, 耗时: {elapsed_time:.2f}秒"
            logger.error(error_msg)
            raise Exception(error_msg)

        except Exception as e:
            elapsed_time = time.time() - start_time
            error_msg = f"生成图像时出错: {str(e)}, 耗时: {elapsed_time:.2f}秒"
            logger.error(error_msg)
            raise Exception(error_msg)

# 创建图像生成服务实例
def create_make_image_service() -> MakeImageService:
    """
    创建图像生成服务实例

    Returns:
        图像生成服务实例
    """
    return MakeImageService()