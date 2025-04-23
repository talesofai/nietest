import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from "axios";

// 创建获取API基础URL的函数，以便其他文件可以导入使用
export const getApiBaseUrl = (): string => {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
};

// 设置API基本URL
const API_BASE_URL = getApiBaseUrl();
const USE_PROXY = process.env.NEXT_PUBLIC_USE_API_PROXY === "true";

/**
 * 获取JWT认证令牌，用于用户认证
 * 这个令牌用于标准的Bearer认证，在Authorization头中使用
 */
export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null; // 服务端运行时返回null

  // 主要从标准的access_token位置获取
  const token = localStorage.getItem("access_token");

  if (token && token !== "undefined" && token !== "null") {
    return token;
  }

  return null; // 如果没有找到token，返回null
};

/**
 * 获取x-token，用于特定API调用
 * 这个令牌用于生图和查询API，与JWT认证令牌不同
 */
export const getXToken = (): string | null => {
  if (typeof window === "undefined") return null; // 服务端运行时返回null

  // 从x_token位置获取
  const token = localStorage.getItem("x_token");

  if (token && token !== "undefined" && token !== "null") {
    return token;
  }

  return null; // 如果没有找到token，返回null
};

// 创建axios实例
const apiClient: AxiosInstance = axios.create({
  // 不设置基础URL，让请求发送到当前域名
  // baseURL: API_BASE_URL,
  timeout: 30000, // 30秒超时
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 获取认证令牌
    const token = getAuthToken();
    const xToken = getXToken();

    // 如果有JWT令牌，添加到请求头
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    // 如果有x-token，添加到请求头
    if (xToken) {
      config.headers["x-token"] = xToken;
    }

    // 不要手动设置Origin头，这是浏览器自动设置的
    // if (typeof window !== 'undefined') {
    //   config.headers['Origin'] = window.location.origin;
    // }

    config.headers["x-platform"] = "nieta-app/web";

    // 打印请求信息
    console.log(
      `发送请求: ${config.method?.toUpperCase()} ${config.baseURL || ""}${config.url}${config.params ? `?${new URLSearchParams(config.params).toString()}` : ""}`,
    );
    // eslint-disable-next-line no-console
    console.log("请求头部:", config.headers);

    return config;
  },
  (error) => {
    // eslint-disable-next-line no-console
    console.error("API请求拦截器错误:", error);

    return Promise.reject(error);
  },
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => {
    // 记录成功响应
    console.log(
      `[响应拦截器] 成功: ${response.config.url}, 状态: ${response.status}`,
    );
    // 直接返回响应数据

    return response;
  },
  (error) => {
    // 处理错误响应
    // eslint-disable-next-line no-console
    console.error("[响应拦截器] 错误:", error);

    // 如果是网络错误或超时
    if (!error.response) {
      // eslint-disable-next-line no-console
      console.error("[响应拦截器] 网络错误或请求超时");

      // 构建详细的错误信息
      const errorInfo = {
        code: "NETWORK_ERROR",
        message: "网络错误，请检查您的网络连接或服务器状态",
        url: error.config?.url,
        method: error.config?.method,
        baseUrl: error.config?.baseURL || API_BASE_URL,
        details: "后端服务可能未启动或不可访问",
        data: null,
      };

      return Promise.reject(errorInfo);
    }

    // 如果是服务器返回的错误
    let errorMessage = "服务器错误";
    const responseData = error.response.data;

    if (responseData && typeof responseData === "object") {
      if (
        "message" in responseData &&
        typeof responseData.message === "string"
      ) {
        errorMessage = responseData.message;
      } else if (
        "detail" in responseData &&
        typeof responseData.detail === "string"
      ) {
        errorMessage = responseData.detail;
      }
    }

    const errorInfo = {
      code: error.response.status,
      message: errorMessage,
      data: responseData?.data || null,
      url: error.config?.url,
      method: error.config?.method,
    };

    // eslint-disable-next-line no-console
    console.error("[响应拦截器] 服务器错误:", errorInfo);

    return Promise.reject(errorInfo);
  },
);

// API响应类型
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  errorDetails?: any;
  status?: number;
  success: boolean;
  message?: string;
  metadata?: {
    total_size?: number;
    total_page_size?: number;
  };
  headers?: any;
}

// 分页响应接口
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// 导入任务相关类型
import { TaskStatus, TaskCreateRequest } from "@/types/task";

// 导出任务状态枚举
export { TaskStatus };

// 任务更新请求接口
interface UpdateTaskRequest {
  title?: string;
  description?: string;
  dueDate?: string;
  priority?: string;
  status?: string;
  // 根据实际需求添加其他字段
}

// 处理请求
const processRequest = async (
  method: string,
  url: string,
  data?: any,
  params?: any,
): Promise<any> => {
  // 处理URL格式
  let processedUrl = url;

  try {
    // 调试信息：输出请求基础信息
    console.log(
      `[API请求] 方法: ${method}, 原始URL: ${url}, 使用代理: ${USE_PROXY}`,
    );
    // eslint-disable-next-line no-console
    console.log(`[API请求] API基础URL: ${API_BASE_URL}`);

    // 确保URL格式正确
    if (!processedUrl.startsWith("/") && !processedUrl.startsWith("http")) {
      processedUrl = "/" + processedUrl;
    }

    // 确保API路径末尾有斜杠（除非URL中包含查询参数或片段标识符）
    if (
      !processedUrl.includes("?") &&
      !processedUrl.includes("#") &&
      !processedUrl.endsWith("/")
    ) {
      processedUrl = processedUrl + "/";
    }

    // eslint-disable-next-line no-console
    console.log(`[API请求] 处理后URL: ${processedUrl}`);

    // 发送请求
    const response: AxiosResponse = await apiClient.request({
      method,
      url: processedUrl,
      data: ["POST", "PUT", "PATCH"].includes(method) ? data : undefined,
      params,
    });

    // 请求成功，记录响应
    // eslint-disable-next-line no-console
    console.log(`[API响应] 状态: ${response.status}, URL: ${processedUrl}`);

    // 检查响应格式是否符合标准格式 {code, message, data}
    const responseData = response.data;

    if (
      responseData &&
      typeof responseData === "object" &&
      "code" in responseData &&
      "data" in responseData
    ) {
      // 标准格式响应，提取data字段

      return {
        success: true,
        data: responseData.data,
        status: responseData.code || response.status,
        message: responseData.message,
        headers: response.headers,
      };
    } else {
      // 非标准格式，直接返回整个响应

      return {
        success: true,
        data: responseData,
        status: response.status,
        headers: response.headers,
      };
    }
  } catch (error: any) {
    // 处理错误
    const axiosError = error as AxiosError;

    // eslint-disable-next-line no-console
    console.error(`[API错误] 请求失败: ${method} ${url}`, axiosError);

    // 检查是否是网络错误或超时
    if (!axiosError.response) {
      // eslint-disable-next-line no-console
      console.error("[API错误] 网络连接失败或超时");

      // 构建详细的错误信息
      const errorDetails = {
        url: url,
        processedUrl: processedUrl,
        method: method,
        message: axiosError.message,
        code: axiosError.code || "NETWORK_ERROR",
      };

      // eslint-disable-next-line no-console
      console.error("[API错误] 详细信息:", errorDetails);

      return {
        success: false,
        data: null,
        error:
          "网络连接失败，可能原因：(1)后端服务未启动 (2)CORS配置错误 (3)网络连接问题",
        errorDetails: errorDetails,
        status: 0,
      };
    }

    // 服务器返回的错误
    console.error(
      `[API错误] 服务器响应错误: ${axiosError.response?.status}`,
      axiosError.response?.data,
    );

    // 检查响应是否符合标准格式 {code, message, data}
    const responseData = axiosError.response?.data;
    let errorMessage = "";

    if (responseData && typeof responseData === "object") {
      if (
        "message" in responseData &&
        typeof responseData.message === "string"
      ) {
        errorMessage = responseData.message;
      } else if (
        "detail" in responseData &&
        typeof responseData.detail === "string"
      ) {
        errorMessage = responseData.detail;
      } else {
        errorMessage = JSON.stringify(responseData);
      }
    } else {
      errorMessage = axiosError.message || "服务器错误";
    }

    return {
      success: false,
      data: null,
      error: errorMessage,
      status: axiosError.response?.status || 500,
    };
  }
};

// 导出API请求方法
export const apiRequest = {
  get: (url: string, params?: any) =>
    processRequest("GET", url, undefined, params),
  post: (url: string, data?: any, params?: any) =>
    processRequest("POST", url, data, params),
  put: (url: string, data?: any, params?: any) =>
    processRequest("PUT", url, data, params),
  delete: (url: string, params?: any) =>
    processRequest("DELETE", url, undefined, params),
  patch: (url: string, data?: any, params?: any) =>
    processRequest("PATCH", url, data, params),
};

/**
 * 获取任务列表
 * @param params 查询参数
 */
export const getTasks = async (params?: any): Promise<ApiResponse<any>> => {
  return apiRequest.get("/api/v1/tasks", params);
};

/**
 * 获取任务详情
 * @param taskId 任务ID
 */
export const getTaskDetail = async (
  taskId: string,
): Promise<ApiResponse<any>> => {
  return apiRequest.get(`/api/v1/tasks/${taskId}`);
};

/**
 * 通过UUID获取任务详情
 * @param taskUuid 任务UUID
 * @returns 任务详情
 */
export const getTaskByUuid = async (
  taskUuid: string,
): Promise<ApiResponse<any>> => {
  return apiRequest.get(`/api/v1/tasks/uuid/${taskUuid}`);
};

/**
 * 创建任务
 * @param data 任务数据
 */
export const createTask = async (
  data: TaskCreateRequest,
): Promise<ApiResponse<any>> => {
  return apiRequest.post("/api/v1/tasks", data);
};

/**
 * 更新任务
 * @param taskId 任务ID
 * @param data 更新数据
 */
export const updateTask = async (
  taskId: string,
  data: UpdateTaskRequest,
): Promise<ApiResponse<any>> => {
  return apiRequest.put(`/api/v1/tasks/${taskId}`, data);
};

/**
 * 删除任务
 * @param taskId 任务ID
 */
export const deleteTask = async (taskId: string): Promise<ApiResponse<any>> => {
  return apiRequest.delete(`/api/v1/tasks/${taskId}`);
};

/**
 * 登录API函数
 * @param email 用户邮箱
 * @param password 用户密码
 */
export const loginApi = async (
  email: string,
  password: string,
): Promise<ApiResponse<any>> => {
  try {
    // 创建FormData对象
    const formData = new FormData();

    formData.append("username", email); // 使用email作为username
    formData.append("password", password);

    // 使用API路由处理登录请求
    const response = await fetch("/api/v1/auth/login", {
      method: "POST",
      body: formData,
    });

    // 解析响应
    const responseData = await response.json();

    // eslint-disable-next-line no-console
    console.log("登录响应数据:", responseData);

    // 如果有错误信息，返回错误
    if (!response.ok || responseData.code >= 400) {
      return {
        success: false,
        error:
          responseData.message ||
          `登录失败: ${response.status} ${response.statusText}`,
        status: responseData.code || response.status,
      };
    }

    // 返回成功响应

    return {
      success: true,
      data: responseData.data,
      status: responseData.code || response.status,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("登录请求错误:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "网络错误",
      status: 500,
    };
  }
};

/**
 * 获取当前用户信息API函数
 */
export const getCurrentUser = async (): Promise<ApiResponse<any>> => {
  return apiRequest.get("/api/v1/users/me");
};

// 导出API客户端
export default apiClient;
