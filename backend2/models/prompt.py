from enum import Enum
from typing import Dict, Any


class PromptType(str, Enum):
    """提示词类型枚举"""
    FREETEXT = "freetext"                    # 自由文本
    OC_VTOKEN_ADAPTOR = "oc_vtoken_adaptor"  # 角色类型
    ELEMENTUM = "elementum"                  # 元素类型


class Prompt:
    """提示词类，用于存储提示词信息"""

    def __init__(self, data: Dict[str, Any]):
        """初始化提示词对象

        Args:
            data: 包含提示词信息的字典

        Raises:
            ValueError: 当必填字段缺失或类型不正确时
        """
        # 验证必填字段
        if 'type' not in data:
            raise ValueError("缺少必填字段: type")
        if 'value' not in data:
            raise ValueError("缺少必填字段: value")

        # 设置基本字段
        self.type = data['type']
        self.value = data['value']

        # 验证类型
        if self.type not in [t.value for t in PromptType]:
            raise ValueError(f"不支持的提示词类型: {self.type}")

        # 设置可选字段
        self.name = data.get('name')
        self.weight = float(data.get('weight', 1.0))
        self.img_url = data.get('img_url')

        # 存储原始数据
        self._data = data

        # 对非freetext类型验证name字段
        if self.type != PromptType.FREETEXT.value and not self.name:
            raise ValueError(f"对于类型 {self.type} 的提示词，name 字段是必填的")

        # FREETEXT类型不需要name和img_url
        if self.type == PromptType.FREETEXT.value:
            self.name = None
            self.img_url = None

    def expand(self) -> Dict[str, Any]:
        """扩展提示词对象为完整的字典

        Returns:
            扩展后的提示词字典
        """
        # 基本字段
        result = {
            "type": self.type,
            "value": self.value,
            "weight": self.weight,
        }

        # FREETEXT类型只需要基本字段
        if self.type == PromptType.FREETEXT.value:
            return result

        # 非FREETEXT类型需要name字段
        result["name"] = self.name

        # 如果有img_url，添加到结果中
        if self.img_url:
            result["img_url"] = self.img_url

        # 根据类型添加额外字段
        if self.type == PromptType.OC_VTOKEN_ADAPTOR.value:
            result.update({
                "uuid": self.value,
                "domain": "",
                "parent": "",
                "label": None,
                "sort_index": 0,
                "status": "IN_USE",
                "polymorphi_values": {},
                "sub_type": None
            })
        elif self.type == PromptType.ELEMENTUM.value:
            result.update({
                "uuid": self.value,
                "domain": "",
                "parent": "",
                "label": None,
                "sort_index": 0,
                "status": "IN_USE",
                "polymorphi_values": {},
                "sub_type": None
            })

        return result
