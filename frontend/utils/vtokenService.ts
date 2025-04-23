import { SearchResponse } from  "@/types/search";
import { ApiSearchType, API_SEARCH_TYPES } from  "@/types/api";

// 本地存储键名常量
const TOKEN_STORAGE_KEY = "vtoken-x-token";


/**
 * 获取本地存储中的x-token
 * @returns 本地存储的x-token或null
 */
export const getXToken = (): string | null => {
  if (typeof window === "undefined") return null;


  return localStorage.getItem(TOKEN_STORAGE_KEY) || null;
};

/**
 * 设置本地存储中的x-token
 * @param token 要保存的token
 */
export const setXToken = (token: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
};

/**
 * 移除本地存储中的x-token
 */
export const removeXToken = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
};

/**
 * 验证token是否有效
 * @param token 要验证的token
 * @returns 是否有效的Promise
 */
export const validateXToken = async (token: string): Promise<boolean> => {
  try {
    // 构建用于验证的URL
    const apiUrl = "/api/v1/users/me";


    // 设置请求头
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-token": token,
      "x-platform": "nieta-app/web",
    };

    // 发送请求
    const response = await fetch(apiUrl, { headers });


    // 返回状态码是否成功


    return response.ok;
  } catch (error) {
    // eslint-disable-next-line no-console
    // eslint-disable-next-line no-console
    // eslint-disable-next-line no-console
console.error("验证token失败:", error);


    return false;
  }
};

/**
 * 搜索角色或元素
 * @param keywords 搜索关键词
 * @param pageIndex 页码（从0开始）
 * @param pageSize 每页结果数
 * @param type 搜索类型 'oc'(角色)或'elementum'(元素)
 * @returns 搜索结果Promise
 */
export const searchCharacterOrElement = async (
  keywords: string,
  pageIndex: number = 0,
  pageSize: number = 12,
  type: ApiSearchType = API_SEARCH_TYPES.OC
): Promise<SearchResponse> => {
  try {
    // 构建API URL
    const url = `https://api.talesofai.cn/v2/travel/parent-search?keywords=${encodeURIComponent(keywords)}&page_index=${pageIndex}&page_size=${pageSize}&parent_type=${type}&sort_scheme=best`;


    // 获取x-token
    const xToken = getXToken();


    // 设置请求头
    const headers: Record<string, string> = {
      "x-platform": "nieta-app/web",
    };

    // 如果有x-token则添加到请求头
    if (xToken) {
      headers["x-token"] = xToken;
    }

    // 发送请求
    const response = await fetch(url, { headers });


    // 如果响应不成功
    if (!response.ok) {

      return {
        data: [],
        metadata: {
          total_size: 0,
          total_page_size: 0,
          page_index: pageIndex,
          page_size: pageSize,
        },
        status: response.status,
        error: `请求失败: ${response.status} ${response.statusText}`,
      };
    }

    // 解析响应
    const responseData = await response.json();
    const totalSize = responseData.total;
    const resultList = responseData.list || [];


    // 处理响应数据
    const data = resultList.map((item: any) => ({
      uuid: item.uuid,
      type: item.type,
      name: item.name,
      header_img: item.config.header_img,
      heat_score: item.heat_score,
    }));

    // 返回符合SearchResponse接口的数据


    return {
      data: data,
      metadata: {
        total_size: totalSize,
        total_page_size: Math.ceil(totalSize / pageSize),
        page_index: pageIndex,
        page_size: pageSize,
      },
      status: response.status,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    // eslint-disable-next-line no-console
    // eslint-disable-next-line no-console
console.error("搜索请求失败:", error);


    return {
      data: [],
      metadata: {
        total_size: 0,
        total_page_size: 0,
        page_index: pageIndex,
        page_size: pageSize,
      },
      error: error instanceof Error ? error.message : "未知错误",
      status: 500,
    };
  }
};

/**
 * 占位图生成器函数
 * @param type 类型 "character" 或 "element"
 * @returns SVG图像的data-URL
 */
export const getPlaceholderSvg = (type: "character" | "element"): string => {
  const text = type === "character" ? "角色" : "元素";



  return `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Crect width="40" height="40" fill="%23dddddd"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="12" fill="%23888888" text-anchor="middle" dominant-baseline="middle"%3E${text}%3C/text%3E%3C/svg%3E`;
};
