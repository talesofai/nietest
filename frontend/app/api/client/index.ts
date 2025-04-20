/**
 * API客户端模块
 *
 * 提供API相关函数和类型的统一导出
 */

// 导出API基础类型
export interface ApiResponse<T = any> {
    data?: T;
    error?: string;
    status?: number;
    metadata?: {
        total_size?: number;
        total_page_size?: number;
    };
}

// 导出分页响应接口 - 解决冲突
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    page_size: number;
}

// 导出搜索相关类型
import { SearchType } from '@/types/search';
export { SearchType };

// 导出所有任务相关类型
export * from './tasks';

// 导出用户认证方法
export { getAuthToken, getXToken, loginApi, getCurrentUser } from '@/utils/apiClient';

// 导出任务管理方法 - 从taskService导出，而不是apiClient
export {
    getTaskList,
    getTaskDetail,
    getTaskByUuid,
    deleteTask,
    cancelTask
} from '@/utils/taskService';