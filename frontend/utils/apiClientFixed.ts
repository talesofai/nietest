import axios, { AxiosInstance, AxiosResponse, AxiosError } from "axios";

// 创建获取API基础URL的函数
export const getApiBaseUrl = (): string => {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
};

// 设置API基本URL
const API_BASE_URL = getApiBaseUrl();

/**
 * 获取完整的API URL
 * 确保所有API请求都使用统一的格式
 * @param path API路径
 * @returns 完整的API URL
 */
export const getApiUrl = (path: string): string => {
  // 确保路径以/开头
  let processedPath = path.startsWith("/") ? path : `/${path}`;
  
  // 确保路径以/api/v1开头
  if (!processedPath.startsWith("/api/v1")) {
    processedPath = `/api/v1${processedPath}`;
  }
  
  // 返回完整URL
  return `${API_BASE_URL}${processedPath}`;
};

/**
 * 获取JWT认证令牌
 */
export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  
  const token = localStorage.getItem("access_token");
  
  if (token && token !== "undefined" && token !== "null") {
    return token;
  }
  
  return null;
};

// 创建axios实例
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 获取认证令牌
    const token = getAuthToken();
    
    // 如果有JWT令牌，添加到请求头
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    
    config.headers["x-platform"] = "nieta-app/web";
    
    // 确保URL格式正确
    if (config.url && !config.url.startsWith("http")) {
      // 如果URL不是以/api/v1开头，添加前缀
      if (!config.url.startsWith("/api/v1")) {
        config.url = `/api/v1${config.url.startsWith("/") ? config.url : `/${config.url}`}`;
      }
    }
    
    return config;
  },
  (error) => {
    console.error("API请求拦截器错误:", error);
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error("[响应拦截器] 错误:", error);
    
    // 如果是网络错误或超时
    if (!error.response) {
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
      if ("message" in responseData && typeof responseData.message === "string") {
        errorMessage = responseData.message;
      } else if ("detail" in responseData && typeof responseData.detail === "string") {
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
    
    return Promise.reject(errorInfo);
  }
);

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  message?: string;
  headers?: any;
}

// 处理成功响应
const handleSuccessResponse = (response: AxiosResponse): ApiResponse<any> => {
  const responseData = response.data;
  
  if (responseData && typeof responseData === "object" && "code" in responseData && "data" in responseData) {
    return {
      success: true,
      data: responseData.data,
      status: responseData.code || response.status,
      message: responseData.message,
      headers: response.headers,
    };
  }
  
  return {
    success: true,
    data: responseData,
    status: response.status,
    headers: response.headers,
  };
};

// 处理网络错误
const handleNetworkError = (error: AxiosError, originalUrl: string, processedUrl: string, method: string): ApiResponse<any> => {
  return {
    success: false,
    error: "网络错误，请检查您的网络连接或服务器状态",
    status: 0,
    message: `请求失败: ${method} ${originalUrl}`,
  };
};

// 处理服务器错误
const handleServerError = (error: AxiosError): ApiResponse<any> => {
  let errorMessage = "服务器错误";
  const responseData = error.response?.data as any;
  
  if (responseData && typeof responseData === "object") {
    if ("message" in responseData && typeof responseData.message === "string") {
      errorMessage = responseData.message;
    } else if ("detail" in responseData && typeof responseData.detail === "string") {
      errorMessage = responseData.detail;
    }
  }
  
  return {
    success: false,
    error: errorMessage,
    status: error.response?.status || 500,
    data: responseData?.data || null,
  };
};

// 处理请求
const processRequest = async (
  method: string,
  url: string,
  data?: any,
  params?: any
): Promise<ApiResponse<any>> => {
  try {
    // 发送请求
    const response: AxiosResponse = await apiClient.request({
      method,
      url,
      data: ["POST", "PUT", "PATCH"].includes(method) ? data : undefined,
      params,
    });
    
    return handleSuccessResponse(response);
  } catch (error: any) {
    const axiosError = error as AxiosError;
    
    // 检查是否是网络错误或超时
    if (!axiosError.response) {
      return handleNetworkError(axiosError, url, url, method);
    }
    
    return handleServerError(axiosError);
  }
};

// 导出API请求方法
export const apiRequest = {
  get: (url: string, params?: any) => processRequest("GET", url, undefined, params),
  post: (url: string, data?: any, params?: any) => processRequest("POST", url, data, params),
  put: (url: string, data?: any, params?: any) => processRequest("PUT", url, data, params),
  delete: (url: string, params?: any) => processRequest("DELETE", url, undefined, params),
  patch: (url: string, data?: any, params?: any) => processRequest("PATCH", url, data, params),
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
export const getTaskDetail = async (taskId: string): Promise<ApiResponse<any>> => {
  return apiRequest.get(`/api/v1/tasks/${taskId}`);
};

/**
 * 创建任务
 * @param data 任务数据
 */
export const createTask = async (data: any): Promise<ApiResponse<any>> => {
  return apiRequest.post("/api/v1/tasks", data);
};

/**
 * 更新任务
 * @param taskId 任务ID
 * @param data 任务数据
 */
export const updateTask = async (taskId: string, data: any): Promise<ApiResponse<any>> => {
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
export const loginApi = async (email: string, password: string): Promise<ApiResponse<any>> => {
  try {
    // 创建FormData对象
    const formData = new FormData();
    
    formData.append("username", email);
    formData.append("password", password);
    
    // 直接调用后端API
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.detail || "登录失败",
        status: response.status,
      };
    }
    
    const data = await response.json();
    
    return {
      success: true,
      data,
      status: response.status,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "登录失败",
      status: 500,
    };
  }
};

export default apiClient;
