from typing import List
from pydantic import BaseModel, Field

from backend2.models.prompt import ConstantPrompt


class Variable(BaseModel):
    """任务变量模型，用于表示变量列表中的每个变量项"""
    id: str = Field(..., description="变量唯一标识符")
    name: str = Field(..., description="变量名称")
    values: List[ConstantPrompt] = Field(default_factory=list, description="变量可能的提示词值列表")
    current_index: int = Field(0, description="当前选中的值索引")

    class Config:
        """Pydantic配置"""
        extra = "allow"  # 允许额外字段
        json_schema_extra = {
            "example": {
                "id": "var_1",
                "name": "人物性别",
                "values": [
                    {
                        "type": "freetext",
                        "value": "male",
                        "weight": 1.0
                    },
                    {
                        "type": "freetext",
                        "value": "female",
                        "weight": 1.0
                    }
                ],
                "current_index": 0
            }
        }