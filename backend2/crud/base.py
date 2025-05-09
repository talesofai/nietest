from typing import Generic, TypeVar, Type, List, Optional, Any, Dict, Union
from uuid import UUID

from backend2.models.db import BaseModel

ModelType = TypeVar("ModelType", bound=BaseModel)


class CRUDBase(Generic[ModelType]):
    """基础CRUD操作类"""

    def __init__(self, model: Type[ModelType]):
        """
        初始化CRUD对象

        Args:
            model: 数据库模型类
        """
        self.model = model

    def get(self, id: Union[int, str, UUID]) -> Optional[ModelType]:
        """
        通过ID获取对象

        Args:
            id: 对象ID

        Returns:
            找到的对象，如果不存在则返回None
        """
        return self.model.get_or_none(self.model.id == id)

    def get_multi(self, *, skip: int = 0, limit: int = 100) -> List[ModelType]:
        """
        获取多个对象

        Args:
            skip: 跳过的记录数
            limit: 返回的最大记录数

        Returns:
            对象列表
        """
        return list(self.model.select().offset(skip).limit(limit))

    def create(self, *, obj_in: Dict[str, Any]) -> ModelType:
        """
        创建对象

        Args:
            obj_in: 要创建的对象数据

        Returns:
            创建的对象
        """
        return self.model.create(**obj_in)

    def update(self, *, db_obj: ModelType, obj_in: Dict[str, Any]) -> ModelType:
        """
        更新对象

        Args:
            db_obj: 数据库中的对象
            obj_in: 要更新的对象数据

        Returns:
            更新后的对象
        """
        for field, value in obj_in.items():
            setattr(db_obj, field, value)
        db_obj.save()
        return db_obj

    def delete(self, *, id: Union[int, str, UUID]) -> bool:
        """
        删除对象

        Args:
            id: 对象ID

        Returns:
            是否成功删除
        """
        obj = self.get(id=id)
        if obj:
            obj.delete_instance()
            return True
        return False

    def save_with_updated_time(self, obj: ModelType) -> ModelType:
        """
        保存对象并更新updated_at字段

        Args:
            obj: 要保存的对象

        Returns:
            保存后的对象
        """
        from datetime import datetime

        # 如果对象有updated_at字段，则更新
        if hasattr(obj, 'updated_at'):
            obj.updated_at = datetime.now()

        obj.save()
        return obj

    def create_tables(self, safe: bool = True) -> None:
        """
        创建模型对应的数据库表

        Args:
            safe: 是否安全创建（如果表已存在则不创建）
        """
        from peewee import PostgresqlDatabase

        db = self.model._meta.database
        if isinstance(db, PostgresqlDatabase):
            db.execute_sql("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";")

        db.create_tables([self.model], safe=safe)
