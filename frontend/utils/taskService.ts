import { apiRequest, ApiResponse } from './apiClient';
import { TaskStatus, TaskDetail } from '@/types/task';

// 分页响应接口
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * 获取任务列表
 * @param page 页码
 * @param pageSize 每页大小
 * @param filters 过滤条件
 * @returns 任务列表和分页信息
 */
export const getTaskList = async (
  page = 1,
  pageSize = 10,
  filters: Record<string, string> = {}
) => {
  try {
    // 构建查询参数
    const queryParams = new URLSearchParams();
    queryParams.append('page', page.toString());
    queryParams.append('page_size', pageSize.toString());

    // 添加其他过滤条件
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        queryParams.append(key, value);
      }
    });

    // 发送请求（确保路径以斜杠结尾）
    const response = await apiRequest.get(`/api/v1/tasks/?${queryParams.toString()}`);

    if (!response.success) {
      console.error('获取任务列表失败:', response.error);
      return {
        success: false,
        error: response.error || '获取任务列表失败',
        data: null
      };
    }

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('获取任务列表出错:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      data: null
    };
  }
};

/**
 * 获取任务详情
 * @param taskId 任务ID
 * @returns 任务详情
 */
export const getTaskDetail = async (taskId: string) => {
  try {
    // 确保taskId有效
    if (!taskId) {
      throw new Error('任务ID不能为空');
    }

    // 发送请求（确保路径以斜杠结尾）
    const response = await apiRequest.get(`/api/v1/tasks/${taskId}/`);

    if (!response.success) {
      console.error('获取任务详情失败:', response.error);
      return {
        success: false,
        error: response.error || '获取任务详情失败',
        data: null
      };
    }

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('获取任务详情出错:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      data: null
    };
  }
};

/**
 * 通过UUID获取任务详情
 * @param taskUuid 任务UUID
 * @returns 任务详情
 */
export const getTaskByUuid = async (taskUuid: string) => {
  try {
    // 确保taskUuid有效
    if (!taskUuid) {
      throw new Error('任务UUID不能为空');
    }

    // 发送请求（确保路径以斜杠结尾）
    const response = await apiRequest.get(`/api/v1/tasks/uuid/${taskUuid}/`);

    if (!response.success) {
      console.error('通过UUID获取任务详情失败:', response.error);
      return {
        success: false,
        error: response.error || '获取任务详情失败',
        data: null
      };
    }

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('通过UUID获取任务详情出错:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      data: null
    };
  }
};

/**
 * 取消任务
 * @param taskId 任务ID
 * @returns 操作结果
 */
export const cancelTask = async (taskId: string) => {
  try {
    // 确保taskId有效
    if (!taskId) {
      throw new Error('任务ID不能为空');
    }

    // 发送请求（确保路径以斜杠结尾）
    const response = await apiRequest.post(`/api/v1/tasks/${taskId}/cancel/`);

    if (!response.success) {
      console.error('取消任务失败:', response.error);
      return {
        success: false,
        error: response.error || '取消任务失败',
        data: null
      };
    }

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('取消任务出错:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      data: null
    };
  }
};

/**
 * 删除任务
 * @param taskId 任务ID
 * @returns 操作结果
 */
export const deleteTask = async (taskId: string) => {
  try {
    // 确保taskId有效
    if (!taskId) {
      throw new Error('任务ID不能为空');
    }

    // 发送请求（确保路径以斜杠结尾）
    const response = await apiRequest.delete(`/api/v1/tasks/${taskId}/`);

    if (!response.success) {
      console.error('删除任务失败:', response.error);
      return {
        success: false,
        error: response.error || '删除任务失败',
        data: null
      };
    }

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('删除任务出错:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      data: null
    };
  }
};
