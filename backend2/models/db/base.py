from peewee import Model
from backend2.utils.db import db

class BaseModel(Model):
    """基础模型类，所有模型都应该继承这个类"""
    class Meta:
        database = db
