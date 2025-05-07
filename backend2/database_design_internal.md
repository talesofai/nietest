# PostgreSQL 内部系统数据库设计

## 概述

本文档提供了一个针对内部系统的简化PostgreSQL数据库设计，仅包含用户、任务和子任务三个核心表。由于是内部系统，用户认证和会话管理可以大幅简化。设计遵循PostgreSQL最佳实践，采用规范化的表结构，合理的数据类型选择，以及高效的索引策略。

## 设计原则

1. **简化设计**：仅保留核心业务表，减少不必要的表
2. **内部系统优化**：简化用户管理，专注于业务功能
3. **使用PostgreSQL特性**：充分利用PostgreSQL特有的数据类型和功能
4. **可扩展性**：设计支持未来功能扩展
5. **性能优化**：通过合理的索引和数据类型选择优化性能
6. **数据完整性**：使用约束和触发器确保数据完整性

## 数据库模式

```sql
-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- 用于文本搜索

-- 创建枚举类型
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'user', 'guest');
CREATE TYPE task_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
CREATE TYPE subtask_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
CREATE TYPE quality_rating AS ENUM ('unrated', 'poor', 'good');
```

### 简化用户管理

```sql
-- 简化用户表 - 内部系统使用
CREATE TABLE users (
    id SERIAL PRIMARY KEY,                            -- 使用自增数字作为主键
    username VARCHAR(50) NOT NULL UNIQUE,             -- 简化为用户名，不需要邮箱
    hashed_password VARCHAR(255) NOT NULL,            -- 存储哈希后的密码
    role user_role NOT NULL DEFAULT 'user',            -- 单一角色
    is_active BOOLEAN NOT NULL DEFAULT TRUE,           -- 是否激活
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),     -- 创建时间
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()      -- 更新时间
);
```

#### 用户表数据示例

查询结果示例：

data_example:
  easy-date

| id | username | hashed_password | role | is_active | created_at | updated_at |
|----|----------|-----------------|--------------|------|-----------|------------|------------|
| 1 | admin | $2b$12$EixZaYVK1... | admin | true | $easy-date | $easy-date |
| 2 | manager | $2b$12$EixZaYVK1... | manager | true | $easy-date | $easy-date |
| 3 | user1 | $2b$12$EixZaYVK1... | user | true | $easy-date | $easy-date |
| 4 | user2 | $2b$12$EixZaYVK1... | user | true | $easy-date | $easy-date |
| 5 | guest | $2b$12$EixZaYVK1... | guest | true | $easy-date | $easy-date |

### 任务管理

```sql
-- 父任务表
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),                                                             -- 使用UUID作为主键
    name VARCHAR(255) NOT NULL,                                                                                 -- 任务名称
    user_id INTEGER NOT NULL,                                                                                   -- 对应users表的id
    status task_status NOT NULL DEFAULT 'pending',                                                              -- ['pending', 'processing', 'completed', 'cancelled']
    make_api_queue VARCHAR(10) DEFAULT NULL,                                                                    -- [null, 'ops', 'dev']
    priority SMALLINT NOT NULL DEFAULT 1,                                                                       -- 任务优先级
    total_images INTEGER NOT NULL DEFAULT 0,                                                                    -- 总图片数
    processed_images INTEGER NOT NULL DEFAULT 0,                                                                -- 已处理图片数
    progress SMALLINT NOT NULL DEFAULT 0,                                                                       -- 进度
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,                                                                  -- 是否已删除
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                                                              -- 创建时间
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,                                                                                   -- 完成时间
    -- 存储任务配置和变量信息
    prompts JSONB NOT NULL DEFAULT '[]'::jsonb,                                                                 -- 存储所有标签（提示词、角色、元素）
    ratio JSONB NOT NULL DEFAULT '{'value': '1:1', 'is_variable': false, 'variable_id': null}'::jsonb,          -- 比例设置
    seed JSONB NOT NULL DEFAULT '{'value': null, 'is_variable': false, 'variable_id': null}'::jsonb,            -- 种子设置
    batch_size JSONB NOT NULL DEFAULT '{'value': 1, 'is_variable': false, 'variable_id': null}'::jsonb,         -- 批次设置
    polish JSONB NOT NULL DEFAULT '{'value': false, 'is_variable': false, 'variable_id': null}'::jsonb,         -- 润色设置
    variables JSONB NOT NULL DEFAULT '{}'::jsonb,                                                               -- 存储变量定义和值
    CONSTRAINT fk_tasks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,                      -- 外键关联到users表
    CONSTRAINT check_progress_range CHECK (progress BETWEEN 0 AND 100)                                          -- 进度范围检查
);
```

#### 任务表数据示例

查询结果示例（简化版，不包含JSON字段的完整内容）：

| id | name | user_id | status | priority | total_images | processed_images | progress | is_deleted | created_at | updated_at | completed_at |
|----|------|---------|--------|----------|--------------|------------------|----------|------------|------------|------------|-------------|
| f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 | 幻想风景生成任务 | 3 | completed | 1 | 4 | 4 | 100 | false | 2023-01-10 00:00:00+00 | 2023-01-10 01:00:00+00 | 2023-01-10 01:00:00+00 |
| f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22 | 科幻人物生成任务 | 4 | processing | 2 | 6 | 3 | 50 | false | 2023-01-11 00:00:00+00 | 2023-01-11 00:30:00+00 | null |
| f2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33 | Lumina风格生成任务 | 3 | pending | 3 | 2 | 0 | 0 | false | 2023-01-12 00:00:00+00 | 2023-01-12 00:00:00+00 | null |


```sql
-- 子任务表
CREATE TABLE subtasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),                                                   -- 使用UUID作为主键
    task_id UUID NOT NULL,                                                                            -- 关联原始任务ID
    status subtask_status NOT NULL DEFAULT 'pending',                                                 -- 任务状态
    variable_indices VARCHAR(100) NOT NULL,                                                           -- 存储子任务在父任务变量空间中的位置, 使用1,2,3,4形式的字符串
    prompts JSONB NOT NULL DEFAULT '[]'::jsonb,                                                       -- 存储所有提示词、角色和元素
    ratio VARCHAR(10) NOT NULL DEFAULT '1:1',                                                         -- 比例
    seed INTEGER,                                                                                     -- 种子
    use_polish BOOLEAN NOT NULL DEFAULT FALSE,                                                        -- 是否使用润色
    batch_size INTEGER NOT NULL DEFAULT 1,                                                            -- 批次
    retry_count SMALLINT NOT NULL DEFAULT 0,                                                          -- 重试次数
    error TEXT,                                                                                       -- 错误信息
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    result JSONB,                                                                                     -- 存储生成结果（图片URL、宽度、高度等）
    rating quality_rating NOT NULL DEFAULT 'unrated',                                                 -- 质量评价：未评价、质量低、质量高
    evaluation TEXT,                                                                                  -- 文本评价
    CONSTRAINT fk_subtasks_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
```

#### 子任务表数据示例

查询结果示例（简化版，不包含JSON字段的完整内容）：

| id | task_id | status | ratio | seed | use_polish | retry_count | created_at | completed_at | rating | evaluation |
|----|---------|--------|-------|------|------------|-------------|------------|--------------|--------|------------|
| s0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 | f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 | completed | 1:1 | 12345 | true | 0 | 2023-01-10 00:00:10+00 | 2023-01-10 00:10:00+00 | good | 构图布局合理，细节丰富，整体效果出色 |
| s1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22 | f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 | completed | 1:1 | 23456 | true | 0 | 2023-01-10 00:00:20+00 | 2023-01-10 00:15:00+00 | poor | 人物比例不协调，背景细节模糊 |
| s2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33 | f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22 | completed | 16:9 | 34567 | true | 0 | 2023-01-11 00:00:10+00 | 2023-01-11 00:10:00+00 | good | 氛围营造得很好，光影效果出色 |
| s3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44 | f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22 | processing | 16:9 | 45678 | true | 0 | 2023-01-11 00:00:20+00 | null | unrated | null |
| s4eebc99-9c0b-4ef8-bb6d-6bb9bd380a55 | f2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33 | pending | 1:1 | null | false | 0 | 2023-01-12 00:00:10+00 | null | unrated | null |

### 任务队列管理

```sql
-- 任务队列表
CREATE TABLE task_queues (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    max_concurrent_tasks INTEGER NOT NULL DEFAULT 10,
    current_concurrent_tasks INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 任务队列表数据示例

查询结果示例：

| id | name | description | max_concurrent_tasks | current_concurrent_tasks | is_active | created_at | updated_at |
|----|------|-------------|----------------------|--------------------------|-----------|------------|------------|
| 1 | standard_tasks | 标准任务队列 | 10 | 2 | true | 2023-01-01 00:00:00+00 | 2023-01-01 00:00:00+00 |
| 2 | lumina_tasks | Lumina风格任务队列 | 5 | 0 | true | 2023-01-01 00:00:00+00 | 2023-01-01 00:00:00+00 |
| 3 | high_priority_tasks | 高优先级任务队列 | 3 | 0 | true | 2023-01-01 00:00:00+00 | 2023-01-01 00:00:00+00 |

```sql
-- 队列任务表
CREATE TABLE queue_tasks (
    id BIGSERIAL PRIMARY KEY,
    queue_id INTEGER NOT NULL,
    subtask_id UUID NOT NULL,
    priority SMALLINT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    enqueued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    worker_id VARCHAR(100),
    CONSTRAINT fk_queue_tasks_queue FOREIGN KEY (queue_id) REFERENCES task_queues(id) ON DELETE CASCADE,
    CONSTRAINT fk_queue_tasks_subtask FOREIGN KEY (subtask_id) REFERENCES subtasks(id) ON DELETE CASCADE
);
```

#### 队列任务表数据示例

查询结果示例：

| id | queue_id | subtask_id | priority | status | enqueued_at | started_at | completed_at | worker_id |
|----|----------|------------|----------|--------|-------------|------------|--------------|----------|
| 1 | 1 | s0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 | 1 | completed | 2023-01-10 00:00:10+00 | 2023-01-10 00:00:15+00 | 2023-01-10 00:10:00+00 | worker-1 |
| 2 | 1 | s1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22 | 1 | completed | 2023-01-10 00:00:20+00 | 2023-01-10 00:00:25+00 | 2023-01-10 00:15:00+00 | worker-2 |
| 3 | 1 | s2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33 | 2 | completed | 2023-01-11 00:00:10+00 | 2023-01-11 00:00:15+00 | 2023-01-11 00:10:00+00 | worker-1 |
| 4 | 1 | s3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44 | 2 | processing | 2023-01-11 00:00:20+00 | 2023-01-11 00:00:25+00 | null | worker-2 |
| 5 | 2 | s4eebc99-9c0b-4ef8-bb6d-6bb9bd380a55 | 3 | pending | 2023-01-12 00:00:10+00 | null | null | null |
```

### 简化系统日志

```sql
-- 系统日志表
CREATE TABLE system_logs (
    id BIGSERIAL PRIMARY KEY,
    log_level VARCHAR(10) NOT NULL,
    component VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 系统日志表数据示例

查询结果示例（简化版，不包含JSON字段的完整内容）：

| id | log_level | component | message | created_at |
|----|-----------|-----------|---------|------------|
| 1 | INFO | api_server | 服务启动 | 2023-01-01 00:00:00+00 |
| 2 | INFO | task_executor | 任务执行器启动 | 2023-01-01 00:01:00+00 |
| 3 | WARNING | database | 数据库连接池接近上限 | 2023-01-02 10:15:00+00 |
| 4 | ERROR | api_server | 请求处理失败 | 2023-01-02 10:16:00+00 |
| 5 | INFO | task_executor | 并发任务数增加 | 2023-01-03 08:00:00+00 |

```sql
-- 任务日志表
CREATE TABLE task_logs (
    id BIGSERIAL PRIMARY KEY,
    task_id UUID,
    subtask_id UUID,
    log_level VARCHAR(10) NOT NULL,
    message TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_task_logs_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_task_logs_subtask FOREIGN KEY (subtask_id) REFERENCES subtasks(id) ON DELETE CASCADE
);
```

#### 任务日志表数据示例

查询结果示例（简化版，不包含JSON字段的完整内容）：

| id | task_id | subtask_id | log_level | message | created_at |
|----|---------|------------|-----------|---------|------------|
| 1 | f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 | null | INFO | 任务创建 | 2023-01-10 00:00:00+00 |
| 2 | f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 | s0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 | INFO | 子任务开始处理 | 2023-01-10 00:00:15+00 |
| 3 | f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 | s0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 | INFO | 子任务完成 | 2023-01-10 00:10:00+00 |
| 4 | f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22 | null | INFO | 任务创建 | 2023-01-11 00:00:00+00 |
| 5 | f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22 | s3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44 | ERROR | 图片生成API调用超时 | 2023-01-11 00:01:00+00 |
| 6 | f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22 | s3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44 | INFO | 子任务重试 | 2023-01-11 00:01:30+00 |
```

## JSONB字段结构说明

### tasks.tags

存储任务使用的所有标签（提示词、角色和元素）。

```json
[
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
  },
  {
    "uuid": "tag-uuid-3",
    "type": "element",
    "value": "element name",
    "weight": 1.0,
    "name": "element display name",
    "header_img": "image_url"
  },
  {
    "uuid": "tag-uuid-4",
    "type": "lumina",
    "value": "lumina name",
    "weight": 1.0,
    "name": "lumina display name",
    "header_img": "image_url"
  }
]
```

### tasks.variables

存储任务变量定义和值。

```json
{
  "v0": {
    "type": "prompt",
    "values": [
      {
        "uuid": "prompt-uuid-1",
        "type": "prompt",
        "value": "prompt1",
        "weight": 1.0,
        "name": "prompt name 1"
      },
      {
        "uuid": "prompt-uuid-2",
        "type": "prompt",
        "value": "prompt2",
        "weight": 1.0,
        "name": "prompt name 2"
      }
    ]
  },
  "v1": {
    "type": "character",
    "values": [
      {
        "uuid": "character-uuid-1",
        "type": "character",
        "value": "character1",
        "weight": 1.0,
        "name": "character name 1",
        "header_img": "image_url_1"
      },
      {
        "uuid": "character-uuid-2",
        "type": "character",
        "value": "character2",
        "weight": 1.0,
        "name": "character name 2",
        "header_img": "image_url_2"
      }
    ]
  }
}
```

### tasks.settings

存储任务设置。

```json
{
  "ratio": "1:1",
  "use_polish": true,
  "default_seed": 12345,
  "other_settings": "value"
}
```

### subtasks.variable_indices

存储子任务在父任务变量空间中的位置。

```json
{
  "v0": 0,
  "v1": 1,
  "v2": null,
  "v3": null,
  "v4": null,
  "v5": null
}
```

### subtasks.prompts

存储子任务使用的所有提示词、角色和元素。

```json
[
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
  },
  {
    "uuid": "element-uuid-1",
    "type": "element",
    "value": "element name",
    "weight": 1.0,
    "name": "element display name",
    "header_img": "image_url"
  }
]
```

### subtasks.result

存储子任务的结果信息。

```json
{
  "url": "image_url",
  "width": 1024,
  "height": 1024,
  "seed": 12345,
  "created_at": "2023-01-01T00:00:00Z",
  "metadata": {
    "generation_time": 5.2,
    "model": "model_name",
    "other_metadata": "value"
  }
}
```

## 索引策略

```sql
-- 用户表索引
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

-- 任务表索引
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);
CREATE INDEX idx_tasks_is_deleted ON tasks(is_deleted);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_tags ON tasks USING GIN(tags jsonb_path_ops);
CREATE INDEX idx_tasks_variables ON tasks USING GIN(variables jsonb_path_ops);

-- 子任务表索引
CREATE INDEX idx_subtasks_task_id ON subtasks(task_id);
CREATE INDEX idx_subtasks_status ON subtasks(status);
CREATE INDEX idx_subtasks_created_at ON subtasks(created_at);
CREATE INDEX idx_subtasks_rating ON subtasks(rating);
CREATE INDEX idx_subtasks_variable_indices ON subtasks USING GIN(variable_indices jsonb_path_ops);
CREATE INDEX idx_subtasks_prompts ON subtasks USING GIN(prompts jsonb_path_ops);

-- 队列任务表索引
CREATE INDEX idx_queue_tasks_queue_id ON queue_tasks(queue_id);
CREATE INDEX idx_queue_tasks_subtask_id ON queue_tasks(subtask_id);
CREATE INDEX idx_queue_tasks_status ON queue_tasks(status);
CREATE INDEX idx_queue_tasks_priority ON queue_tasks(priority);
CREATE INDEX idx_queue_tasks_enqueued_at ON queue_tasks(enqueued_at);

-- 系统日志表索引
CREATE INDEX idx_system_logs_log_level ON system_logs(log_level);
CREATE INDEX idx_system_logs_component ON system_logs(component);
CREATE INDEX idx_system_logs_created_at ON system_logs(created_at);

-- 任务日志表索引
CREATE INDEX idx_task_logs_task_id ON task_logs(task_id);
CREATE INDEX idx_task_logs_subtask_id ON task_logs(subtask_id);
CREATE INDEX idx_task_logs_log_level ON task_logs(log_level);
CREATE INDEX idx_task_logs_created_at ON task_logs(created_at);
```

## 表分区策略

对于大型表，可以使用PostgreSQL的表分区功能提高性能：

```sql
-- 子任务表分区（按任务ID分区）
CREATE TABLE subtasks_partitioned (
    id UUID NOT NULL,
    task_id UUID NOT NULL,
    status subtask_status NOT NULL DEFAULT 'pending',
    variable_indices JSONB NOT NULL DEFAULT '{}'::jsonb,
    prompts JSONB NOT NULL DEFAULT '[]'::jsonb,
    ratio VARCHAR(10) NOT NULL DEFAULT '1:1',
    seed INTEGER,
    use_polish BOOLEAN NOT NULL DEFAULT FALSE,
    retry_count SMALLINT NOT NULL DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    result JSONB,
    rating quality_rating NOT NULL DEFAULT 'unrated',
    evaluation TEXT,
    PRIMARY KEY (task_id, id)
) PARTITION BY HASH (task_id);

-- 创建16个分区
CREATE TABLE subtasks_partition_0 PARTITION OF subtasks_partitioned FOR VALUES WITH (MODULUS 16, REMAINDER 0);
CREATE TABLE subtasks_partition_1 PARTITION OF subtasks_partitioned FOR VALUES WITH (MODULUS 16, REMAINDER 1);
-- ... 创建其余分区 ...
CREATE TABLE subtasks_partition_15 PARTITION OF subtasks_partitioned FOR VALUES WITH (MODULUS 16, REMAINDER 15);

-- 系统日志表分区（按时间分区）
CREATE TABLE system_logs_partitioned (
    id BIGSERIAL NOT NULL,
    log_level VARCHAR(10) NOT NULL,
    component VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (created_at, id)
) PARTITION BY RANGE (created_at);

-- 创建按月分区
CREATE TABLE system_logs_y2023m01 PARTITION OF system_logs_partitioned
    FOR VALUES FROM ('2023-01-01') TO ('2023-02-01');
CREATE TABLE system_logs_y2023m02 PARTITION OF system_logs_partitioned
    FOR VALUES FROM ('2023-02-01') TO ('2023-03-01');
-- ... 创建其余分区 ...
```

## 视图

创建视图简化常见查询：

```sql
-- 任务详情视图
CREATE VIEW task_details AS
SELECT
    t.id,
    t.name,
    t.status,
    t.priority,
    t.total_images,
    t.processed_images,
    t.progress,
    t.created_at,
    t.updated_at,
    t.completed_at,
    u.username,
    u.display_name,
    COUNT(DISTINCT s.id) AS subtask_count,
    COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.id END) AS completed_subtasks,
    COUNT(DISTINCT CASE WHEN s.status = 'failed' THEN s.id END) AS failed_subtasks,
    COUNT(DISTINCT CASE WHEN s.rating = 'good' THEN s.id END) AS good_quality_images,
    COUNT(DISTINCT CASE WHEN s.rating = 'poor' THEN s.id END) AS poor_quality_images
FROM
    tasks t
JOIN
    users u ON t.user_id = u.id
LEFT JOIN
    subtasks s ON t.id = s.task_id
WHERE
    t.is_deleted = FALSE
GROUP BY
    t.id, u.username, u.display_name;

-- 子任务详情视图
CREATE VIEW subtask_details AS
SELECT
    s.id,
    s.task_id,
    s.status,
    s.variable_indices,
    s.ratio,
    s.seed,
    s.use_polish,
    s.retry_count,
    s.created_at,
    s.updated_at,
    s.started_at,
    s.completed_at,
    s.result,
    s.rating,
    s.evaluation,
    t.name AS task_name,
    u.username
FROM
    subtasks s
JOIN
    tasks t ON s.task_id = t.id
JOIN
    users u ON t.user_id = u.id;

-- 队列状态视图
CREATE VIEW queue_status AS
SELECT
    q.id,
    q.name,
    q.description,
    q.max_concurrent_tasks,
    q.current_concurrent_tasks,
    q.is_active,
    COUNT(qt.id) AS total_tasks,
    COUNT(CASE WHEN qt.status = 'pending' THEN 1 END) AS pending_tasks,
    COUNT(CASE WHEN qt.status = 'processing' THEN 1 END) AS processing_tasks,
    COUNT(CASE WHEN qt.status = 'completed' THEN 1 END) AS completed_tasks,
    COUNT(CASE WHEN qt.status = 'failed' THEN 1 END) AS failed_tasks,
    AVG(CASE WHEN qt.status = 'completed' THEN
        EXTRACT(EPOCH FROM (qt.completed_at - qt.started_at))
    END) AS avg_processing_time_seconds
FROM
    task_queues q
LEFT JOIN
    queue_tasks qt ON q.id = qt.queue_id
GROUP BY
    q.id, q.name, q.description, q.max_concurrent_tasks, q.current_concurrent_tasks, q.is_active;
```

## 函数和触发器

```sql
-- 更新任务进度的函数
CREATE OR REPLACE FUNCTION update_task_progress()
RETURNS TRIGGER AS $$
BEGIN
    -- 更新任务的已处理图片数和进度
    UPDATE tasks
    SET
        processed_images = (
            SELECT COUNT(*)
            FROM subtasks
            WHERE task_id = NEW.task_id AND status IN ('completed', 'failed')
        ),
        progress = (
            SELECT
                CASE
                    WHEN total_images > 0 THEN
                        LEAST(100, ROUND(COUNT(*) * 100.0 / total_images))
                    ELSE 0
                END
            FROM subtasks
            WHERE task_id = NEW.task_id AND status IN ('completed', 'failed')
        ),
        updated_at = NOW()
    WHERE id = NEW.task_id;

    -- 如果所有子任务都已完成，更新任务状态为已完成
    UPDATE tasks
    SET
        status = 'completed',
        completed_at = NOW()
    WHERE
        id = NEW.task_id AND
        (SELECT COUNT(*) FROM subtasks WHERE task_id = NEW.task_id AND status NOT IN ('completed', 'failed', 'cancelled')) = 0 AND
        (SELECT COUNT(*) FROM subtasks WHERE task_id = NEW.task_id) > 0;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建子任务状态变更触发器
CREATE TRIGGER trigger_update_task_progress
AFTER UPDATE OF status ON subtasks
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION update_task_progress();

-- 创建子任务插入触发器
CREATE TRIGGER trigger_update_task_progress_on_insert
AFTER INSERT ON subtasks
FOR EACH ROW
EXECUTE FUNCTION update_task_progress();

-- 更新时间戳的函数
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为所有需要更新时间戳的表创建触发器
CREATE TRIGGER trigger_update_timestamp
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trigger_update_timestamp
BEFORE UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trigger_update_timestamp
BEFORE UPDATE ON subtasks
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trigger_update_timestamp
BEFORE UPDATE ON task_queues
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();
```

## 数据类型选择说明

1. **UUID vs. SERIAL**：
   - 使用UUID作为主键可以支持分布式系统，避免ID冲突
   - 对于关联表和日志表使用SERIAL/BIGSERIAL提高性能

2. **TIMESTAMPTZ vs. TIMESTAMP**：
   - 使用TIMESTAMPTZ存储时间，自动处理时区问题

3. **JSONB vs. JSON**：
   - 使用JSONB存储JSON数据，支持索引和高效查询
   - 使用JSONB存储标签、变量和结果等复杂数据结构

4. **枚举类型**：
   - 使用枚举类型限制可能的值，提高数据完整性

## 性能优化策略

1. **索引策略**：
   - 为所有外键创建索引
   - 为经常用于过滤和排序的列创建索引
   - 使用GIN索引支持JSONB字段的查询

2. **表分区**：
   - 对大型表使用表分区，提高查询性能
   - 按时间分区日志表，便于数据归档和清理
   - 按任务ID分区子任务表，提高单个任务的查询性能

3. **物化视图**：
   - 为复杂查询创建物化视图，定期刷新

4. **查询优化**：
   - 使用视图简化复杂查询
   - 使用函数和触发器自动维护冗余数据

5. **连接池**：
   - 使用连接池管理数据库连接，减少连接开销


