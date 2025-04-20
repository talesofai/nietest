/**
 * 任务相关的类型定义
 */

import { Tag } from './tag';
import { Variables } from './variable';

/**
 * 任务状态枚举
 */
export enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * 任务详情接口
 */
export interface TaskDetail {
  id: string;
  task_name: string;
  username: string;
  status: TaskStatus;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
  total_images?: number;
  processed_images?: number;
  progress?: number;
  concurrency?: number;
  error?: string;
  tags: Tag[];
  variables: Variables;
  settings: Record<string, any>;
  results?: any;
}

/**
 * 基本任务信息接口
 */
export interface TaskResponse {
  id: string;
  task_name: string;
  username: string;
  status: TaskStatus;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
  total_images?: number;
  processed_images?: number;
  progress?: number;
  concurrency?: number;
  error?: string;
}

/**
 * 任务创建请求接口
 */
export interface TaskCreateRequest {
  task_name: string;
  username: string;
  tags: Tag[];
  variables: Variables;
  settings: Record<string, any>;
}
