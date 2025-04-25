import axios, { AxiosInstance, AxiosResponse } from "axios";

import { ApiResponse } from "@/types/api";
import { TaskCreateRequest, TaskDetail, TaskMatrix, TaskResponse } from "@/types/task";

// 获取API基础URL
const getApiBaseUrl = (): string => {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
};

// 设置API基本URL
const API_BASE_URL = getApiBaseUrl();
// 确保使用环境变量中的API基础URL
const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || API_BASE_URL;

// 获取认证令牌
const getAuthToken = (): string | null => {
  if (typeof window !== "undefined") {
    // 尝试从多个可能的位置获取token
    const token =
      localStorage.getItem("access_token") ||
      localStorage.getItem("auth_token") ||
      sessionStorage.getItem("access_token");

    if (token && token !== "undefined" && token !== "null") {
      return token;
    }
  }

  return null;
};

// 创建axios实例
const createAuthAxios = (): AxiosInstance => {
  // 确保使用正确的API基础URL
  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL || NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

  // eslint-disable-next-line no-console
  console.log("API基础URL:", baseUrl);

  const instance = axios.create({
    baseURL: `${baseUrl}/api/v1`,
    timeout: 30000, // 30秒超时
    headers: {
      "Content-Type": "application/json",
    },
  });

  // 请求拦截器：添加认证头
  instance.interceptors.request.use(
    (config) => {
      const token = getAuthToken();

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // 响应拦截器：处理认证错误
  instance.interceptors.response.use(
    (response) => {
      return response;
    },
    (error) => {
      // 如果是401错误（未授权），可以重定向到登录页面
      if (error.response && error.response.status === 401) {
      }

      return Promise.reject(error);
    }
  );

  return instance;
};

// 创建认证axios实例
const authAxios = createAuthAxios();

// 处理成功响应
const handleSuccessResponse = (response: AxiosResponse): ApiResponse<any> => {
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
  }

  // 非标准格式，直接返回整个响应
  return {
    success: true,
    data: responseData,
    status: response.status,
    headers: response.headers,
  };
};

/**
 * 任务相关API
 */
const taskApi = {
  /**
   * 获取任务列表
   * @param page 页码
   * @param pageSize 每页大小
   * @param filters 过滤条件
   * @returns 任务列表和分页信息
   */
  getTaskList: async (
    page = 1,
    pageSize = 10,
    filters: Record<string, string> = {}
  ): Promise<ApiResponse<TaskResponse[]>> => {
    try {
      // 确保页码和每页数量是有效的数字
      const validPage = Math.max(1, Number(page));
      const validPageSize = Math.max(1, Math.min(100, Number(pageSize)));

      // 构建查询参数
      const params = {
        page: validPage,
        page_size: validPageSize,
        ...filters,
      };

      // 调试信息
      console.log("apiService.getTaskList - 请求参数:", params);

      // 发送请求
      const response = await authAxios.get("/tasks", { params });

      // 调试响应
      console.log("apiService.getTaskList - 原始响应:", response.data);

      // 处理响应
      const result = handleSuccessResponse(response);

      // 添加分页元数据
      if (result.success && !result.metadata) {
        // 如果响应中没有分页元数据，则添加默认的分页元数据
        result.metadata = {
          page: validPage,
          page_size: validPageSize,
          total: Array.isArray(result.data) ? result.data.length : 0
        };
      }

      console.log("apiService.getTaskList - 处理后的结果:", result);

      return result;
    } catch (error) {
      console.error("获取任务列表失败:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "获取任务列表失败",
        status: 500,
      };
    }
  },

  /**
   * 获取任务详情
   * @param taskId 任务ID
   * @returns 任务详情
   */
  getTaskDetail: async (taskId: string): Promise<ApiResponse<TaskDetail>> => {
    try {
      const response = await authAxios.get(`/tasks/${taskId}`);

      return handleSuccessResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "获取任务详情失败",
        status: 500,
      };
    }
  },

  /**
   * 通过UUID获取任务详情
   * @param taskUuid 任务UUID
   * @returns 任务详情
   */
  getTaskByUuid: async (taskUuid: string): Promise<ApiResponse<TaskDetail>> => {
    try {
      const response = await authAxios.get(`/tasks/uuid/${taskUuid}`);

      return handleSuccessResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "获取任务详情失败",
        status: 500,
      };
    }
  },

  /**
   * 创建任务
   * @param data 任务数据
   * @returns 创建结果
   */
  createTask: async (data: TaskCreateRequest): Promise<ApiResponse<any>> => {
    try {
      const response = await authAxios.post("/tasks", data);

      return handleSuccessResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "创建任务失败",
        status: 500,
      };
    }
  },

  /**
   * 更新任务
   * @param taskId 任务ID
   * @param data 更新数据
   * @returns 更新结果
   */
  updateTask: async (
    taskId: string,
    data: Partial<TaskCreateRequest>
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await authAxios.put(`/tasks/${taskId}`, data);

      return handleSuccessResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "更新任务失败",
        status: 500,
      };
    }
  },

  /**
   * 删除任务
   * @param taskId 任务ID
   * @returns 删除结果
   */
  deleteTask: async (taskId: string): Promise<ApiResponse<any>> => {
    try {
      const response = await authAxios.delete(`/tasks/${taskId}`);

      return handleSuccessResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "删除任务失败",
        status: 500,
      };
    }
  },

  /**
   * 取消任务
   * @param taskId 任务ID
   * @returns 取消结果
   */
  cancelTask: async (taskId: string): Promise<ApiResponse<any>> => {
    try {
      const response = await authAxios.post(`/tasks/${taskId}/cancel`);

      return handleSuccessResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "取消任务失败",
        status: 500,
      };
    }
  },

  /**
   * 获取任务矩阵数据
   * @param taskId 任务ID
   * @returns 任务矩阵数据
   */
  getTaskMatrix: async (taskId: string): Promise<ApiResponse<TaskMatrix>> => {
    try {
      const response = await authAxios.get(`/tasks/${taskId}/matrix`);

      return handleSuccessResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "获取任务矩阵数据失败",
        status: 500,
      };
    }
  },
};

/**
 * 用户相关API
 */
const userApi = {
  /**
   * 获取当前用户信息
   * @returns 用户信息
   */
  getCurrentUser: async (): Promise<ApiResponse<any>> => {
    try {
      const response = await authAxios.get("/users/me");

      return handleSuccessResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "获取用户信息失败",
        status: 500,
      };
    }
  },

  /**
   * 登录
   * @param email 邮箱
   * @param password 密码
   * @returns 登录结果
   */
  login: async (email: string, password: string): Promise<ApiResponse<any>> => {
    try {
      // 创建FormData对象
      const formData = new FormData();

      formData.append("username", email);
      formData.append("password", password);

      // 使用正确的API基础URL
      const baseUrl =
        process.env.NEXT_PUBLIC_API_BASE_URL || NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

      // eslint-disable-next-line no-console
      console.log("登录API基础URL:", baseUrl);

      // 使用axios直接调用登录接口，不需要认证
      const response = await axios.post(`${baseUrl}/api/v1/auth/login`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // 如果登录成功，保存token
      if (
        response.status === 200 &&
        response.data &&
        response.data.data &&
        response.data.data.access_token
      ) {
        if (typeof window !== "undefined") {
          localStorage.setItem("auth_token", response.data.data.access_token);
        }
      }

      // 转换为标准API响应格式
      return {
        success: response.status >= 200 && response.status < 300,
        data: response.data.data,
        status: response.status,
        error: response.status >= 400 ? response.data.message || "登录失败" : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "登录失败",
        status: 500,
      };
    }
  },

  /**
   * 注册
   * @param email 邮箱
   * @param password 密码
   * @param fullname 全名
   * @returns 注册结果
   */
  register: async (
    email: string,
    password: string,
    fullname: string
  ): Promise<ApiResponse<any>> => {
    try {
      // 使用正确的API基础URL
      const baseUrl =
        process.env.NEXT_PUBLIC_API_BASE_URL || NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

      // eslint-disable-next-line no-console
      console.log("注册API基础URL:", baseUrl);

      // 注册不需要认证
      const response = await axios.post(`${baseUrl}/api/v1/auth/register`, {
        email,
        password,
        fullname,
      });

      return handleSuccessResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "注册失败",
        status: 500,
      };
    }
  },

  /**
   * 退出登录
   * @returns 退出结果
   */
  logout: async (): Promise<ApiResponse<any>> => {
    try {
      const response = await authAxios.post("/auth/logout");

      // 退出登录后，清除token
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth_token");
      }

      return handleSuccessResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "退出登录失败",
        status: 500,
      };
    }
  },
};

/**
 * 系统相关API
 */
const systemApi = {
  /**
   * 获取系统健康状态
   * @returns 健康状态
   */
  getHealth: async (): Promise<ApiResponse<any>> => {
    try {
      // 健康检查不需要认证，但使用正确的API基础URL
      const baseUrl =
        process.env.NEXT_PUBLIC_API_BASE_URL || NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
      const response = await axios.get(`${baseUrl}/api/v1/health`);

      return handleSuccessResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "获取系统健康状态失败",
        status: 500,
      };
    }
  },

  /**
   * 获取系统版本信息
   * @returns 版本信息
   */
  getVersion: async (): Promise<ApiResponse<any>> => {
    try {
      // 版本信息不需要认证，但使用正确的API基础URL
      const baseUrl =
        process.env.NEXT_PUBLIC_API_BASE_URL || NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
      const response = await axios.get(`${baseUrl}/api/v1/version`);

      return handleSuccessResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "获取系统版本信息失败",
        status: 500,
      };
    }
  },
};

/**
 * 搜索相关API
 */
const searchApi = {
  /**
   * 搜索任务
   * @param keyword 关键词
   * @param page 页码
   * @param pageSize 每页大小
   * @returns 搜索结果
   */
  searchTasks: async (
    keyword: string,
    page = 1,
    pageSize = 10
  ): Promise<ApiResponse<TaskResponse[]>> => {
    try {
      // 使用authAxios确保使用正确的API基础URL
      const response = await authAxios.get(`/search/tasks`, {
        params: {
          keyword,
          page,
          page_size: pageSize,
        },
      });

      return handleSuccessResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "搜索任务失败",
        status: 500,
      };
    }
  },
};

/**
 * 统一的API服务
 */
export const apiService = {
  task: taskApi,
  user: userApi,
  system: systemApi,
  search: searchApi,
};
