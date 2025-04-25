from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
import os
from typing import List

def setup_cors(app: FastAPI) -> None:
    """
    设置CORS中间件，允许跨域请求
    
    Args:
        app: FastAPI应用实例
    """
    # 从环境变量获取允许的源，如果没有设置，则使用默认值
    cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    cors_origins = cors_origins_str.split(",")
    
    # 如果需要允许所有源，可以使用["*"]
    # cors_origins = ["*"]
    
    # 添加CORS中间件
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],  # 允许前端访问的响应头
    )
    
    print(f"CORS已配置，允许的源: {cors_origins}")
