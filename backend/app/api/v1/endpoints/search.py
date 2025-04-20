from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body, Header

from app.schemas.common import APIResponse

router = APIRouter()

@router.post("/{search_type}", response_model=APIResponse)
async def search(
    search_type: str,
    search_data: Dict[str, Any],
    x_token: Optional[str] = Header(None)
):
    """
    搜索角色或元素
    
    Args:
        search_type: 搜索类型，如"character"、"element"
        search_data: 搜索数据，包含关键词、页码等
        x_token: 认证令牌
        
    Returns:
        搜索结果
    """
    # 这里是模拟实现，实际项目中需要调用真实的搜索API
    # 在这个示例中，我们返回一些模拟数据
    
    # 检查搜索类型
    if search_type not in ["character", "element"]:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的搜索类型: {search_type}"
        )
    
    # 获取搜索参数
    keywords = search_data.get("keywords", "")
    page_index = search_data.get("page_index", 0)
    page_size = search_data.get("page_size", 12)
    
    # 模拟搜索结果
    items = []
    for i in range(min(page_size, 5)):  # 最多返回5个结果
        items.append({
            "uuid": f"uuid-{i}",
            "type": search_type,
            "name": f"{keywords}-{i}" if keywords else f"{search_type}-{i}",
            "header_img": f"https://example.com/{search_type}_{i}.png",
            "heat_score": 100 - i * 10
        })
    
    # 构建响应
    response_data = {
        "items": items,
        "metadata": {
            "total_size": 14,
            "total_page_size": 2,
            "page_index": page_index,
            "page_size": page_size
        }
    }
    
    return APIResponse(
        code=200,
        message="success",
        data=response_data
    )
