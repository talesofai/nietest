from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union
from bson import ObjectId
from pydantic import BaseModel

# 定义模型类型变量
ModelType = TypeVar("ModelType", bound=BaseModel)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)

class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """CRUD基类"""
    
    def __init__(self, model: Type[ModelType], collection_name: str):
        """
        初始化CRUD基类
        
        Args:
            model: 模型类
            collection_name: 集合名称
        """
        self.model = model
        self.collection_name = collection_name
    
    async def get(self, db: Any, id: str) -> Optional[Dict[str, Any]]:
        """
        通过ID获取记录
        
        Args:
            db: 数据库连接
            id: 记录ID
            
        Returns:
            记录，如果不存在则返回None
        """
        record = await db[self.collection_name].find_one({"_id": ObjectId(id)})
        if record:
            record["id"] = str(record.pop("_id"))
        return record
    
    async def get_multi(
        self, db: Any, *, skip: int = 0, limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        获取多条记录
        
        Args:
            db: 数据库连接
            skip: 跳过的记录数
            limit: 返回的记录数
            
        Returns:
            记录列表
        """
        cursor = db[self.collection_name].find().skip(skip).limit(limit)
        records = await cursor.to_list(length=limit)
        
        # 转换ID为字符串
        for record in records:
            record["id"] = str(record.pop("_id"))
        
        return records
    
    async def create(self, db: Any, *, obj_in: CreateSchemaType) -> Dict[str, Any]:
        """
        创建记录
        
        Args:
            db: 数据库连接
            obj_in: 创建模式
            
        Returns:
            创建的记录
        """
        obj_in_data = obj_in.dict()
        result = await db[self.collection_name].insert_one(obj_in_data)
        
        # 获取创建的记录
        created_record = await self.get(db, str(result.inserted_id))
        return created_record
    
    async def update(
        self, db: Any, *, id: str, obj_in: Union[UpdateSchemaType, Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """
        更新记录
        
        Args:
            db: 数据库连接
            id: 记录ID
            obj_in: 更新模式或字典
            
        Returns:
            更新后的记录，如果不存在则返回None
        """
        # 获取现有记录
        record = await self.get(db, id)
        if not record:
            return None
        
        # 准备更新数据
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)
        
        # 执行更新
        await db[self.collection_name].update_one(
            {"_id": ObjectId(id)},
            {"$set": update_data}
        )
        
        # 获取更新后的记录
        updated_record = await self.get(db, id)
        return updated_record
    
    async def delete(self, db: Any, *, id: str) -> bool:
        """
        删除记录
        
        Args:
            db: 数据库连接
            id: 记录ID
            
        Returns:
            是否删除成功
        """
        result = await db[self.collection_name].delete_one({"_id": ObjectId(id)})
        return result.deleted_count > 0
