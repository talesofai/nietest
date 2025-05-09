"""
核心模块

提供应用核心功能
"""

from backend2.core.config import settings
from backend2.core.app import initialize_app, shutdown_app
from backend2.core.security import get_password_hash, verify_password
from backend2.core.auth import require_permission, require_role

__all__ = [
    "settings",
    "initialize_app",
    "shutdown_app",
    "get_password_hash",
    "verify_password",
    "require_permission",
    "require_role"
]