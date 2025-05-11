"""
自定义Peewee字段模块

提供基于Pydantic模型的字段，用于自动序列化和反序列化
"""
from typing import Type, Optional, Any, TypeVar, Generic, List

from playhouse.postgres_ext import JSONField
from pydantic import BaseModel as PydanticBaseModel

# 类型变量，用于Pydantic模型
PM = TypeVar('PM', bound=PydanticBaseModel)


class PydanticModelField(JSONField, Generic[PM]):
    """
    Peewee字段，用于存储单个Pydantic模型实例。
    它将Pydantic模型序列化为JSON存入数据库，并在取出时反序列化回模型实例。
    """
    def __init__(self, model_class: Type[PM], *args, **kwargs):
        """
        Args:
            model_class: 要存储的Pydantic模型类。
        """
        if not issubclass(model_class, PydanticBaseModel):
            raise TypeError(f"model_class必须是pydantic.BaseModel的子类, 得到 {model_class}")
        self.model_class = model_class
        super().__init__(*args, **kwargs)  # Pass *args, **kwargs to JSONField

    def db_value(self, value: Optional[PM]) -> Optional[str]:
        """将Pydantic模型实例转换为可存储的JSON字符串"""
        if value is None:
            return None
        if not isinstance(value, self.model_class):
            raise TypeError(f"期望值是 {self.model_class.__name__} 的实例, 但得到 {type(value).__name__}")

        # 使用Pydantic的model_dump()方法进行序列化
        # super().db_value() 会将字典转换为JSON字符串
        return super().db_value(value.model_dump(mode='json'))  # mode='json'确保特殊类型如datetime正确转换

    def python_value(self, value: Optional[Any]) -> Optional[PM]:
        """将从数据库中检索的JSON数据转换为Pydantic模型实例"""
        # super().python_value() 会将JSON字符串转换为Python字典
        dict_value = super().python_value(value)

        if dict_value is None:
            return None
        if not isinstance(dict_value, dict):
            # This might happen if the JSON stored is not an object, e.g. "null" string or a bare array
            raise ValueError(f"期望从数据库获取字典来构建 {self.model_class.__name__}, 但得到 {type(dict_value)}")

        try:
            return self.model_class(**dict_value)
        except Exception as e:  # Catch Pydantic validation errors or other issues
            # 可以考虑记录错误 e
            raise ValueError(f"无法将字典转换为 {self.model_class.__name__}: {e}") from e

    # For Peewee 3.x+, type hinting the field itself
    def __Entity__(self) -> Type[Optional[PM]]:
        return Optional[self.model_class]


class PydanticListField(JSONField, Generic[PM]):
    """
    Peewee字段，用于存储Pydantic模型实例的列表。
    它将Pydantic模型列表序列化为JSON存入数据库，并在取出时反序列化回模型实例列表。
    """
    def __init__(self, model_class: Type[PM], *args, **kwargs):
        """
        Args:
            model_class: 列表中Pydantic模型元素的类。
        """
        if not issubclass(model_class, PydanticBaseModel):
            raise TypeError(f"model_class必须是pydantic.BaseModel的子类, 得到 {model_class}")
        self.model_class = model_class
        # 确保默认值是 list 构造函数，这样 default=[] 也会正确工作
        # 如果 kwargs 提供了 default, 使用它；否则，如果未提供且 name 不是 nullable，Peewee 可能需要 default
        if 'default' not in kwargs and not kwargs.get('null', False):
             kwargs.setdefault('default', list)
        super().__init__(*args, **kwargs)

    def db_value(self, value: Optional[List[PM]]) -> Optional[str]:
        """将Pydantic模型实例列表转换为可存储的JSON格式"""
        if value is None:
            # 如果字段是 nullable 且值为 None，则返回 None 以在数据库中存储 NULL
            # 如果字段非 nullable 但 default=list，则空列表 [] 会被处理
            return None

        if not isinstance(value, list):
            raise TypeError(f"期望值是列表, 但得到 {type(value).__name__}")

        dict_list = []
        for i, item in enumerate(value):
            if not isinstance(item, self.model_class):
                raise TypeError(
                    f"列表中的第 {i} 个元素期望是 {self.model_class.__name__} 的实例, "
                    f"但得到 {type(item).__name__}"
                )
            dict_list.append(item.model_dump(mode='json'))  # mode='json'确保特殊类型如datetime正确转换

        return super().db_value(dict_list)

    def python_value(self, value: Optional[Any]) -> List[PM]:  # 总是返回一个列表
        """将从数据库中检索的JSON数据转换为Pydantic模型实例列表"""
        list_of_dicts = super().python_value(value)

        if list_of_dicts is None:
            # 如果数据库中的值是 NULL, 返回一个空列表 (符合 default=list 的行为)
            # 这样调用者就不必每次都检查 None
            return []

        if not isinstance(list_of_dicts, list):
            raise ValueError(
                f"期望从数据库获取列表来构建 {self.model_class.__name__} 列表, "
                f"但得到 {type(list_of_dicts)}"
            )

        model_list = []
        for i, item_dict in enumerate(list_of_dicts):
            if not isinstance(item_dict, dict):
                raise ValueError(
                    f"列表中的第 {i} 个元素期望是字典, 但得到 {type(item_dict).__name__}"
                )
            try:
                model_list.append(self.model_class(**item_dict))
            except Exception as e:
                raise ValueError(
                    f"无法将列表中的第 {i} 个字典元素转换为 {self.model_class.__name__}: {e}"
                ) from e
        return model_list