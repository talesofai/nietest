import { apiService } from "@/utils/api/apiService";

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
    // 确保页码和每页数量是有效的数字
    const validPage = Math.max(1, Number(page));
    const validPageSize = Math.max(1, Math.min(100, Number(pageSize)));

    // 调试信息
    console.log(`taskService.getTaskList - 页码: ${validPage}, 每页数量: ${validPageSize}, 过滤条件:`, filters);

    // 使用统一的API服务
    const response = await apiService.task.getTaskList(validPage, validPageSize, filters);

    // 调试响应
    console.log("taskService.getTaskList - API响应:", response);

    if (response.error || (response.status && response.status >= 400)) {
      console.error("获取任务列表失败:", response.error);

      return {
        success: false,
        error: response.error || "获取任务列表失败",
        data: null,
      };
    }

    // 确保返回的数据包含分页信息
    const result = {
      success: true,
      data: response.data,
      metadata: response.metadata || {
        total: Array.isArray(response.data) ? response.data.length : 0,
        page: validPage,
        page_size: validPageSize
      }
    };

    console.log("taskService.getTaskList - 处理后的结果:", result);

    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("获取任务列表出错:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
      data: null,
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
      throw new Error("任务ID不能为空");
    }

    // 使用统一的API服务
    const response = await apiService.task.getTaskDetail(taskId);

    if (response.error || (response.status && response.status >= 400)) {
      // eslint-disable-next-line no-console
      console.error("获取任务详情失败:", response.error);

      return {
        success: false,
        error: response.error || "获取任务详情失败",
        data: null,
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("获取任务详情出错:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
      data: null,
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
      throw new Error("任务UUID不能为空");
    }

    // 使用统一的API服务
    const response = await apiService.task.getTaskByUuid(taskUuid);

    if (response.error || (response.status && response.status >= 400)) {
      // eslint-disable-next-line no-console
      console.error("通过UUID获取任务详情失败:", response.error);

      return {
        success: false,
        error: response.error || "获取任务详情失败",
        data: null,
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("通过UUID获取任务详情出错:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
      data: null,
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
      throw new Error("任务ID不能为空");
    }

    // 使用统一的API服务
    const response = await apiService.task.cancelTask(taskId);

    if (response.error || (response.status && response.status >= 400)) {
      // eslint-disable-next-line no-console
      console.error("取消任务失败:", response.error);

      return {
        success: false,
        error: response.error || "取消任务失败",
        data: null,
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("取消任务出错:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
      data: null,
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
      throw new Error("任务ID不能为空");
    }

    // 使用统一的API服务
    const response = await apiService.task.deleteTask(taskId);

    if (response.error || (response.status && response.status >= 400)) {
      // eslint-disable-next-line no-console
      console.error("删除任务失败:", response.error);

      return {
        success: false,
        error: response.error || "删除任务失败",
        data: null,
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("删除任务出错:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
      data: null,
    };
  }
};

/**
 * 获取任务矩阵数据（六维空间坐标系统）
 * @param taskId 任务ID
 * @returns 任务矩阵数据
 */
/**
 * 处理详细的错误信息
 * @param error 捕获的错误
 * @param logPrefix 日志前缀
 * @returns 格式化的错误信息
 */
const handleDetailedError = (error: unknown, logPrefix: string): string => {
  // eslint-disable-next-line no-console
  console.error(`${logPrefix}:`, error);

  let errorMessage = "未知错误";

  if (error instanceof Error) {
    errorMessage = error.message;

    // 特殊处理网络错误
    if (errorMessage === "Network Error") {
      return "网络连接错误，无法连接到服务器";
    }

    // 检查是否有更详细的错误信息
    const errorWithDetails = error as any;

    if (errorWithDetails.errorDetails) {
      const details = errorWithDetails.errorDetails;

      // eslint-disable-next-line no-console
      console.error("详细错误信息:", details);

      if (details.code === "ECONNREFUSED") {
        return "无法连接到服务器，请检查服务器是否运行";
      }
      if (details.code === "ECONNABORTED") {
        return "请求超时，请稍后重试";
      }
    }
  }

  return errorMessage;
};

/**
 * 获取任务矩阵数据（六维空间坐标系统）
 * @param taskId 任务ID
 * @returns 任务矩阵数据
 */
export const getTaskMatrix = async (taskId: string) => {
  try {
    // 确保taskId有效
    if (!taskId) {
      throw new Error("任务ID不能为空");
    }

    // 使用统一的API服务
    const response = await apiService.task.getTaskMatrix(taskId);

    if (response.error || (response.status && response.status >= 400)) {
      // eslint-disable-next-line no-console
      console.error("获取任务矩阵数据失败:", response.error);

      return {
        success: false,
        error: response.error || "获取任务矩阵数据失败",
        data: null,
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    const errorMessage = handleDetailedError(error, "获取任务矩阵数据出错");

    return {
      success: false,
      error: errorMessage,
      data: null,
    };
  }
};
