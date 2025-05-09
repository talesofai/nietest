"""
基础模型模块

定义所有模型的基类
"""
from peewee import Model
from backend2.db import test_db_proxy

class BaseModel(Model):
    """
    基础db模型类，所有db模型都应该继承这个类
    """
    class Meta:
        database = test_db_proxy
