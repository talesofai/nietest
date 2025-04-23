// 导入搜索相关类型和函数
import { searchCharacterOrElement, setXToken } from "@/utils/vtokenService";
import { API_SEARCH_TYPES } from "@/types/api";
import { SearchResponse } from "@/types/search";

/**
 * GET 请求处理函数
 */
export async function GET(req: Request) {
  try {
    // 获取URL参数
    const url = new URL(req.url);
    const keywords = url.searchParams.get("keywords") || "";
    const pageIndex = parseInt(url.searchParams.get("page_index") || "0", 10);
    const pageSize = parseInt(url.searchParams.get("page_size") || "12", 10);

    // 获取请求头中的x-token
    const headers = req.headers;
    const xToken = headers.get("x-token");

    // 如果提供了xToken，先设置到本地存储
    if (xToken) {
      setXToken(xToken);
    }

    // 搜索元素
    const searchResults: SearchResponse = await searchCharacterOrElement(
      keywords,
      pageIndex,
      pageSize,
      API_SEARCH_TYPES.ELEMENTUM,
    );

    // 返回结果
    return Response.json(searchResults);
  } catch (error) {
    console.error("处理搜索请求失败:", error);

    return Response.json({ total_size: 0, data: [] }, { status: 500 });
  }
}
