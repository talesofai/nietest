/**
 * API 响应接口
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  metadata?: any;
  message?: string;
  headers?: any;
}

/**
 * 用户信息接口
 */
export interface User {
  _id: string;
  email: string;
  fullname?: string;
  roles: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * 标准 API 响应格式
 */
export interface StandardApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/**
 * 登录令牌数据
 */
export interface TokenData {
  access_token: string;
  token_type: string;
}

/**
 * 登录响应接口
 */
export interface LoginResponse extends StandardApiResponse<TokenData> {}

/**
 * 搜索类型枚举
 * @deprecated 请使用 types/search.ts 中的 SearchType
 */
export enum SearchType {
  OC = "oc",
  ELEMENTUM = "elementum",
}

/**
 * 内部搜索类型，用于与外部API通信
 */
export type ApiSearchType = "oc" | "elementum";

/**
 * 搜索类型常量
 */
export const API_SEARCH_TYPES = {
  OC: "oc" as ApiSearchType,
  ELEMENTUM: "elementum" as ApiSearchType,
};

/**
 * 搜索响应的元数据
 * @deprecated 请使用 types/search.ts 中的 SearchMetadata
 */
export interface SearchMetadata {
  total_size: number;
  total_page_size: number;
}

/**
 * API 响应码
 */
export enum API_STATUS_CODES {
  SUCCESS = 200,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  SERVER_ERROR = 500,
}

/**
 * API 平台标识
 */
export const API_PLATFORM = "nieta-app/web";

/**
 * API 基础URL
 */
export const API_BASE_URL = "https://api.talesofai.cn/v2";

// 导出搜索类型定义
export * from "./search";
