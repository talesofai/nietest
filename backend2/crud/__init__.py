"""
CRUD 操作模块
"""

from backend2.crud.base import CRUDBase
from backend2.crud.user import user_crud
from backend2.crud.task import task_crud
from backend2.crud.subtask import subtask_crud

__all__ = ["CRUDBase", "user_crud", "task_crud", "subtask_crud"]
