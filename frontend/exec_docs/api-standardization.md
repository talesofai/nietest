# API调用标准化文档

## 概述

为了确保整个仓库中API调用方式的一致性和可维护性，我们实施了API调用标准化。本文档描述了标准化的API调用方式、实现细节和使用指南。

## 标准化实现

### 1. 创建统一的API服务层

我们创建了一个集中的API服务层 `apiService.ts`，将所有API调用集中到一个地方，确保一致性和可维护性。该服务层包含以下几个主要部分：

- **任务相关API** (`taskApi`)：处理任务的创建、查询、更新和删除
- **用户相关API** (`userApi`)：处理用户认证和用户信息获取
- **系统相关API** (`systemApi`)：处理系统级别的API，如健康检查
- **搜索相关API** (`searchApi`)：处理搜索功能

### 2. 规范化API路径

为了确保API路径格式的一致性，我们在API服务中采用了统一的路径格式：

- 以斜杠开头
- 不以斜杠结尾

这样可以避免因路径格式不一致导致的问题。我们在每个API函数中都确保了路径格式的一致性。

### 3. 统一错误处理

所有API调用都使用统一的错误处理机制，确保错误信息的一致性和可理解性。我们使用以下方式检查API响应中的错误：

```typescript
// 检查是否有错误
if (response.error || (response.status && response.status >= 400)) {
  // 处理错误
  console.error("API调用失败:", response.error);
  // ...
}
```

这种方式可以兼容不同的API响应格式，确保错误处理的一致性。

## 使用指南

### 基本用法

```typescript
import { apiService } from "@/utils/api/apiService";

// 获取任务列表
const response = await apiService.task.getTaskList(1, 10, { status: "pending" });

// 获取任务详情
const taskDetail = await apiService.task.getTaskDetail("task-id");

// 创建任务
const newTask = await apiService.task.createTask(taskData);

// 获取用户信息
const userInfo = await apiService.user.getCurrentUser();
```

### 错误处理

```typescript
try {
  const response = await apiService.task.getTaskDetail(taskId);

  if (response.error || (response.status && response.status >= 400)) {
    // 处理错误
    console.error("获取任务详情失败:", response.error);
    return;
  }

  // 处理成功响应
  const taskData = response.data;
  // ...
} catch (error) {
  // 处理异常
  console.error("请求异常:", error);
}
```

## 已修改的文件

1. 新增 `utils/api/apiService.ts`：统一的API服务层
2. 修改 `utils/taskService.ts`：使用统一的API服务，修复类型兼容性问题
3. 修改 `components/tags/submit/submitUtils.ts`：使用统一的API服务，修复类型兼容性问题
4. 修改 `components/history/TaskDetailView.tsx`：优化API调用，避免重复请求，修复类型兼容性问题

## 优化点

1. **减少重复代码**：通过集中管理API调用，减少了重复代码
2. **统一错误处理**：所有API调用使用统一的错误处理机制
3. **路径一致性**：确保所有API路径格式一致
4. **类型安全**：提供了类型定义，增强了类型安全性
5. **可维护性**：当API变更时，只需要修改一个地方

## 后续建议

1. **完善类型定义**：为API响应和请求参数添加更详细的类型定义
2. **添加请求缓存**：对于频繁请求的数据，考虑添加缓存机制
3. **添加请求取消功能**：支持取消正在进行的请求
4. **添加请求重试机制**：对于可能因网络问题失败的请求，添加自动重试机制
5. **添加请求拦截器**：在请求发送前和响应接收后添加拦截器，用于日志记录、认证等

## 结论

通过实施API调用标准化，我们提高了代码的可维护性和一致性，减少了因API调用方式不一致导致的问题。所有组件现在都使用统一的API服务层，确保了API调用的一致性和可靠性。
