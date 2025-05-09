from enum import Enum
from typing import Dict, Any, Optional, Union, List
from pydantic import BaseModel, Field, field_validator, model_validator


class PromptType(str, Enum):
    """提示词类型枚举"""
    FREETEXT = "freetext"                    # 自由文本
    OC_VTOKEN_ADAPTOR = "oc_vtoken_adaptor"  # 角色类型
    ELEMENTUM = "elementum"                  # 元素类型


class Prompt(BaseModel):
    """通用提示词模型，根据is_variable自动处理变量或常量提示词"""
    type: str = Field(..., description="提示词类型")
    value: Optional[str] = Field(None, description="提示词值", exclude_unset=True)
    is_variable: bool = Field(default=False, description="是否为变量")

    # 变量提示词特有字段
    variable_id: Optional[str] = Field(None, description="变量ID", exclude_unset=True)
    variable_name: Optional[str] = Field(None, description="变量名称", exclude_unset=True)

    # 常量提示词特有字段
    weight: float = Field(1.0, description="权重")
    img_url: Optional[str] = Field(None, description="图片URL", exclude_unset=True)
    uuid: Optional[str] = Field(None, description="唯一标识符", exclude_unset=True)
    name: Optional[str] = Field(None, description="提示词名称", exclude_unset=True)

    @field_validator('type')
    def validate_type(cls, v):
        """验证提示词类型"""
        if v not in [t.value for t in PromptType]:
            raise ValueError(f"不支持的提示词类型: {v}")
        return v

    @model_validator(mode='after')
    def validate_by_variable_type(self):
        """根据is_variable验证字段"""
        if self.is_variable:
            # 变量提示词必须包含variable_id和variable_name
            if not self.variable_id or not self.variable_name:
                raise ValueError("变量提示词必须包含variable_id和variable_name")
        else:
            # 常量提示词必须包含value
            if not self.value:
                raise ValueError("常量提示词必须包含value")

            # 非FREETEXT类型需要额外字段
            if self.type != PromptType.FREETEXT.value:
                if not self.name:
                    raise ValueError("非text提示词的name字段不能为空")
                if not self.img_url:
                    raise ValueError("非text提示词的img_url字段不能为空")

        return self

    def expand(self) -> Dict[str, Any]:
        """扩展常量提示词为完整的字典

        Returns:
            扩展后的提示词字典

        Raises:
            ValueError: 如果提示词是变量类型
        """
        # 验证是否为常量提示词
        if self.is_variable:
            raise ValueError("变量提示词无法扩展")

        # 基本字段
        result = {
            "type": self.type,
            "value": self.value,
            "weight": self.weight,
        }

        # FREETEXT类型只需要基本字段
        if self.type == PromptType.FREETEXT.value:
            return result

        # 非FREETEXT类型需要额外字段
        result["name"] = self.name
        result["img_url"] = self.img_url

        # 根据类型添加额外字段
        if self.type in [PromptType.OC_VTOKEN_ADAPTOR.value, PromptType.ELEMENTUM.value]:
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

    class Config:
        """Pydantic配置"""
        extra = "allow"  # 允许额外字段
        json_schema_extra = {
            "example": {
                "type": "freetext",
                "value": "1girl, cute",
                "is_variable": False,
                "weight": 1.0
            }
        }