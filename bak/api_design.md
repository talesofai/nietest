# API设计文档

## 概述

本文档详细描述了Backend2系统的API设计。API采用RESTful风格，使用JSON作为数据交换格式，并提供统一的响应结构。

## API基础

### 基础URL

```
/api/v1
```

### 认证

除了公开的API外，所有API都需要通过JWT认证。认证令牌通过Authorization头传递。

```
Authorization: Bearer {token}
```

### 响应格式

所有API响应都使用统一的格式：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    // 响应数据
  }
}
```

错误响应：

```json
{
  "code": 400,
  "message": "错误信息",
  "data": null
}
```

### 状态码

- 200: 成功
- 400: 请求错误
- 401: 未认证
- 403: 权限不足
- 404: 资源不存在
- 500: 服务器错误

## API端点

### 认证API

#### 登录

```
POST /api/v1/auth/login
```

请求体：

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

响应：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "expires_in": 604800,
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "fullname": "User Name",
      "roles": ["user"]
    }
  }
}
```

#### 获取当前用户信息

```
GET /api/v1/auth/me
```

响应：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "user-uuid",
    "email": "user@example.com",
    "fullname": "User Name",
    "roles": ["user"]
  }
}
```

### 用户API

#### 获取用户列表

```
GET /api/v1/users
```

查询参数：

- page: 页码，默认1
- limit: 每页数量，默认10
- search: 搜索关键词

响应：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "user-uuid-1",
        "email": "user1@example.com",
        "fullname": "User One",
        "roles": ["user"],
        "is_active": true,
        "created_at": "2023-01-01T00:00:00Z"
      },
      // ...
    ],
    "total": 100,
    "page": 1,
    "limit": 10,
    "pages": 10
  }
}
```

#### 创建用户

```
POST /api/v1/users
```

请求体：

```json
{
  "email": "newuser@example.com",
  "password": "password",
  "fullname": "New User",
  "roles": ["user"]
}
```

响应：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "new-user-uuid",
    "email": "newuser@example.com",
    "fullname": "New User",
    "roles": ["user"],
    "is_active": true,
    "created_at": "2023-01-01T00:00:00Z"
  }
}
```

### 任务API

#### 创建任务

```
POST /api/v1/tasks
```

请求体：

```json
{
  "task_name": "测试任务",
  "tags": [
    {
      "uuid": "tag-uuid-1",
      "type": "prompt",
      "value": "prompt text",
      "weight": 1.0,
      "name": "prompt name"
    },
    {
      "uuid": "tag-uuid-2",
      "type": "character",
      "value": "character name",
      "weight": 1.0,
      "name": "character display name",
      "header_img": "image_url"
    }
  ],
  "variables": {
    "v0": {
      "type": "prompt",
      "values": ["prompt1", "prompt2"]
    },
    "v1": {
      "type": "character",
      "values": ["character1", "character2"]
    }
  },
  "settings": {
    "ratio": "1:1",
    "use_polish": true
  },
  "priority": 1
}
```

响应：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "task-uuid",
    "task_name": "测试任务",
    "username": "user@example.com",
    "status": "pending",
    "created_at": "2023-01-01T00:00:00Z",
    "updated_at": "2023-01-01T00:00:00Z",
    "total_images": 4,
    "processed_images": 0,
    "progress": 0,
    "priority": 1
  }
}
```

#### 获取任务列表

```
GET /api/v1/tasks
```

查询参数：

- page: 页码，默认1
- limit: 每页数量，默认10
- status: 任务状态，可选值：pending, processing, completed, failed, cancelled
- search: 搜索关键词

响应：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "task-uuid-1",
        "task_name": "任务1",
        "username": "user@example.com",
        "status": "completed",
        "created_at": "2023-01-01T00:00:00Z",
        "updated_at": "2023-01-01T01:00:00Z",
        "total_images": 4,
        "processed_images": 4,
        "progress": 100,
        "priority": 1
      },
      // ...
    ],
    "total": 100,
    "page": 1,
    "limit": 10,
    "pages": 10
  }
}
```

#### 获取任务详情

```
GET /api/v1/tasks/{task_id}
```

响应：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "task-uuid",
    "task_name": "测试任务",
    "username": "user@example.com",
    "tags": [
      {
        "uuid": "tag-uuid-1",
        "type": "prompt",
        "value": "prompt text",
        "weight": 1.0,
        "name": "prompt name"
      },
      {
        "uuid": "tag-uuid-2",
        "type": "character",
        "value": "character name",
        "weight": 1.0,
        "name": "character display name",
        "header_img": "image_url"
      }
    ],
    "variables": {
      "v0": {
        "type": "prompt",
        "values": ["prompt1", "prompt2"]
      },
      "v1": {
        "type": "character",
        "values": ["character1", "character2"]
      }
    },
    "settings": {
      "ratio": "1:1",
      "use_polish": true
    },
    "status": "completed",
    "created_at": "2023-01-01T00:00:00Z",
    "updated_at": "2023-01-01T01:00:00Z",
    "total_images": 4,
    "processed_images": 4,
    "progress": 100,
    "priority": 1,
    "subtasks": [
      {
        "id": "subtask-uuid-1",
        "status": "completed",
        "result": {
          "url": "image_url_1",
          "width": 1024,
          "height": 1024,
          "seed": 12345,
          "created_at": "2023-01-01T00:30:00Z"
        },
        "variable_indices": [0, 0, null, null, null, null],
        "rating": 1,
        "evaluate": "很好的图片"
      },
      // ...
    ]
  }
}
```

#### 取消任务

```
POST /api/v1/tasks/{task_id}/cancel
```

响应：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "task-uuid",
    "status": "cancelled"
  }
}
```

#### 删除任务

```
DELETE /api/v1/tasks/{task_id}
```

响应：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "task-uuid",
    "deleted": true
  }
}
```

### 子任务API

#### 获取子任务详情

```
GET /api/v1/subtasks/{subtask_id}
```

响应：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "subtask-uuid",
    "parent_task_id": "task-uuid",
    "status": "completed",
    "result": {
      "url": "image_url",
      "width": 1024,
      "height": 1024,
      "seed": 12345,
      "created_at": "2023-01-01T00:30:00Z"
    },
    "variable_indices": [0, 0, null, null, null, null],
    "prompts": [
      {
        "uuid": "prompt-uuid-1",
        "type": "prompt",
        "value": "prompt text",
        "weight": 1.0,
        "name": "prompt name"
      },
      {
        "uuid": "character-uuid-1",
        "type": "character",
        "value": "character name",
        "weight": 1.0,
        "name": "character display name",
        "header_img": "image_url"
      }
    ],
    "ratio": "1:1",
    "seed": 12345,
    "use_polish": true,
    "created_at": "2023-01-01T00:00:00Z",
    "updated_at": "2023-01-01T00:30:00Z",
    "rating": 1,
    "evaluate": "很好的图片"
  }
}
```

#### 评价子任务

```
POST /api/v1/subtasks/{subtask_id}/rate
```

请求体：

```json
{
  "rating": 1,
  "evaluate": "很好的图片"
}
```

响应：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "subtask-uuid",
    "rating": 1,
    "evaluate": "很好的图片"
  }
}
```

### 系统监控API

#### 获取系统状态

```
GET /api/v1/system/status
```

响应：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "api_server": {
      "status": "healthy",
      "uptime": 86400,
      "version": "1.0.0"
    },
    "database": {
      "status": "healthy",
      "connections": 10,
      "max_connections": 100
    },
    "redis": {
      "status": "healthy",
      "used_memory": "100MB",
      "max_memory": "1GB"
    },
    "task_queues": {
      "standard_tasks": {
        "length": 10,
        "processing_rate": 5,
        "workers": 4
      },
      "lumina_tasks": {
        "length": 5,
        "processing_rate": 2,
        "workers": 2
      },
      "high_priority_tasks": {
        "length": 0,
        "processing_rate": 0,
        "workers": 1
      }
    }
  }
}
```

#### 获取任务统计

```
GET /api/v1/system/task-stats
```

响应：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total_tasks": 1000,
    "by_status": {
      "pending": 10,
      "processing": 20,
      "completed": 950,
      "failed": 15,
      "cancelled": 5
    },
    "by_date": {
      "2023-01-01": 100,
      "2023-01-02": 150,
      // ...
    },
    "by_user": {
      "user1@example.com": 500,
      "user2@example.com": 300,
      // ...
    },
    "processing_rate": {
      "last_hour": 60,
      "last_day": 1440,
      "last_week": 10080
    }
  }
}
```

## 错误码

| 错误码 | 描述 |
|--------|------|
| 400001 | 请求参数错误 |
| 400002 | 请求体格式错误 |
| 401001 | 未认证 |
| 401002 | 令牌已过期 |
| 403001 | 权限不足 |
| 404001 | 资源不存在 |
| 500001 | 服务器内部错误 |
| 500002 | 数据库错误 |
| 500003 | 任务处理错误 |

## API版本控制

API版本通过URL路径控制，当前版本为v1。未来版本将使用v2、v3等路径。

```
/api/v1/...
/api/v2/...
```

## 限流策略

API实施限流策略，防止滥用：

- 认证API: 10次/分钟
- 用户API: 60次/分钟
- 任务API: 120次/分钟
- 系统监控API: 30次/分钟

超过限制将返回429状态码。

## API文档

API文档使用OpenAPI/Swagger提供，可通过以下URL访问：

```
/docs
/redoc
```

## 安全考虑

1. **HTTPS**: 所有API通信必须使用HTTPS
2. **JWT**: 使用JWT进行认证，支持令牌刷新
3. **CORS**: 实施严格的CORS策略
4. **输入验证**: 严格验证所有输入
5. **敏感数据**: 敏感数据在响应中脱敏
