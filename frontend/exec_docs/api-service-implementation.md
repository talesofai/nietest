# API服务实现文档

## 概述

本文档记录了API服务层的实现过程，包括创建统一的API服务层、修复类型问题和解决循环依赖问题。

## 实现细节

### 1. 创建统一的API服务层

我们创建了一个集中的API服务层 `apiService.ts`，将所有API调用集中到一个地方，确保一致性和可维护性。该服务层包含以下几个主要部分：

- **任务相关API** (`taskApi`)：处理任务的创建、查询、更新和删除
- **用户相关API** (`userApi`)：处理用户认证和用户信息获取
- **系统相关API** (`systemApi`)：处理系统级别的API，如健康检查
- **搜索相关API** (`searchApi`)：处理搜索功能

### 2. 修复类型问题

我们更新了 `ApiResponse` 接口，添加了 `success` 字段，以及其他可选字段，使其与实际使用保持一致：

```typescript
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  metadata?: any;
  message?: string;
  headers?: any;
}
```

### 3. 解决循环依赖问题

为了避免循环依赖问题，我们在 `apiService.ts` 中直接使用 `axios` 发送请求，而不是依赖 `apiClient.ts` 中的函数。同时，我们在 `apiClient.ts` 中导入并导出 `apiService`，确保其他模块可以通过 `@/utils/apiClient` 路径导入 `apiService`。

## 使用示例

```typescript
import { apiService } from "@/utils/apiClient";

// 获取任务列表
const response = await apiService.task.getTaskList(1, 10, { status: "pending" });

// 获取任务详情
const taskDetail = await apiService.task.getTaskDetail("task-id");

// 创建任务
const newTask = await apiService.task.createTask(taskData);

// 获取用户信息
const userInfo = await apiService.user.getCurrentUser();
```

## 错误处理

所有API函数都包含统一的错误处理机制，确保即使在发生异常的情况下，也能返回标准格式的响应：

```typescript
try {
  const response = await axios.get(`${API_BASE_URL}/api/v1/tasks/${taskId}`);
  return handleSuccessResponse(response);
} catch (error) {
  return {
    success: false,
    error: error instanceof Error ? error.message : "获取任务详情失败",
    status: 500,
  };
}
```

## 后续优化建议

1. **添加请求缓存**：对于频繁请求的数据，考虑添加缓存机制
2. **添加请求取消功能**：支持取消正在进行的请求
3. **添加请求重试机制**：对于可能因网络问题失败的请求，添加自动重试机制
4. **添加请求拦截器**：在请求发送前和响应接收后添加拦截器，用于日志记录、认证等
5. **添加类型安全**：为API响应和请求参数添加更详细的类型定义
