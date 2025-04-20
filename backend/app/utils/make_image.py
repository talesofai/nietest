from typing import Dict, Any, Optional
import logging

from app.services.image import ImageGenerationService

# 配置日志
logger = logging.getLogger(__name__)

# 图片生成器缓存
_image_generators: Dict[str, ImageGenerationService] = {}

def create_image_generator(x_token: str = "") -> ImageGenerationService:
    """
    创建或获取图片生成器
    
    Args:
        x_token: API认证的token
        
    Returns:
        图片生成器实例
    """
    global _image_generators
    
    # 如果已存在相同token的生成器，直接返回
    if x_token in _image_generators:
        return _image_generators[x_token]
    
    # 创建新的生成器
    generator = ImageGenerationService(x_token)
    _image_generators[x_token] = generator
    
    return generator
