/**
 * 任务相关的类型定义
 */

import { Tag } from "./tag";
import { Variables } from "./variable";

/**
 * 任务状态枚举
 */
export enum TaskStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

/**
 * 任务详情接口
 */
export interface SubTask {
  id: string;
  parent_task_id: string;
  status: string;
  result?: {
    url: string;
    width: number;
    height: number;
    seed: number;
    created_at: string;
  };
  error?: string;
  retry_count: number;
  prompt: {
    value: string;
    weight: number;
  };
  characters: Array<{
    value: string;
    name: string;
    weight: number;
    header_url: string;
  }>;
  elements: Array<any>;
  ratio: string;
  seed?: number;
  use_polish: boolean;
  created_at: string;
  updated_at: string;
  v0?: number;
  v1?: number;
  v2?: number;
  v3?: number;
  v4?: number;
  v5?: number;
}

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
  dramatiq_tasks?: SubTask[];
}

/**
 * 任务矩阵数据接口
 */
export interface TaskMatrix {
  task_id: string;
  task_name: string;
  created_at: string;
  variables: Variables;
  coordinates_by_indices: Record<string, string>; // 基于索引的坐标映射，键是逗号分隔的索引字符串（例如 '0,1,,,'），值是图片URL
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
