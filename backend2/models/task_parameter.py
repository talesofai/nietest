from typing import Any, Optional, Dict
from pydantic import BaseModel, Field


class TaskParameter(BaseModel):
    """任务参数模型，用于标准化表示各种配置参数"""
    type: str = Field(..., description="参数类型，如ratio、seed等")
    value: Any = Field(None, description="参数值")
    is_variable: bool = Field(False, description="是否为变量")
    variable_id: Optional[str] = Field(None, description="变量ID", exclude_unset=True)
    variable_name: Optional[str] = Field("", description="变量名称", exclude_unset=True)
    format: Optional[str] = Field(None, description="参数格式，如string、int、bool、float")

    class Config:
        """Pydantic配置"""
        extra = "allow"  # 允许额外字段
        json_schema_extra = {
            "example": {
                "type": "ratio",
                "value": "1:1",
                "is_variable": False,
                "format": "string"
            }
        }