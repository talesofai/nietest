# 任务处理系统设计

## 概述

本文档详细描述了基于自定义任务执行器的任务处理系统设计。新系统使用Drizzle ORM进行数据访问，提供更高的可靠性、可扩展性和性能。

## 系统架构

任务处理系统采用分布式架构，由以下组件组成：

1. **API服务**：接收任务请求，创建任务记录，提交任务到执行器
2. **任务执行器**：管理任务队列和执行任务
3. **Worker进程**：执行具体的任务
4. **数据库**：使用MongoDB存储任务数据和结果
5. **监控系统**：监控任务执行状态和系统性能

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  API服务    │────▶│  任务执行器 │────▶│  Worker进程 │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────┐
│                      MongoDB                        │
└─────────────────────────────────────────────────────┘
```

## 任务执行器配置

### 配置参数

```typescript
// 任务执行器配置接口
interface TaskExecutorConfig {
  // 并发控制
  initialConcurrentTasks: number;  // 初始并发任务数
  maxConcurrentTasks: number;      // 最大并发任务数
  tasksPerScaleUp: number;         // 每次扩展增加的任务数
  scaleUpInterval: number;         // 扩展间隔（毫秒）
  scaleDownInterval: number;       // 缩减间隔（毫秒）

  // Lumina任务特殊配置
  luminaConfig?: {
    initialConcurrentTasks: number;
    tasksPerScaleUp: number;
    scaleUpInterval: number;
    timeout: number;
    pollingInterval: number;
    maxAttempts: number;
  };
}

// 默认配置
const defaultConfig: TaskExecutorConfig = {
  initialConcurrentTasks: 10,
  maxConcurrentTasks: 50,
  tasksPerScaleUp: 5,
  scaleUpInterval: 60000,  // 1分钟
  scaleDownInterval: 180000,  // 3分钟

  luminaConfig: {
    initialConcurrentTasks: 2,
    tasksPerScaleUp: 2,
    scaleUpInterval: 120000,  // 2分钟
    timeout: 300000,  // 5分钟
    pollingInterval: 5000,  // 5秒
    maxAttempts: 60
  }
};
```

### 任务执行器实现

```typescript
class TaskExecutor {
  private config: TaskExecutorConfig;
  private currentConcurrentTasks: number;
  private luminaConcurrentTasks: number;
  private lastScaleUpTime: number;
  private lastScaleDownTime: number;
  private runningTasks: Map<string, Promise<void>>;

  constructor(config: TaskExecutorConfig = defaultConfig) {
    this.config = config;
    this.currentConcurrentTasks = config.initialConcurrentTasks;
    this.luminaConcurrentTasks = config.luminaConfig?.initialConcurrentTasks || 2;
    this.lastScaleUpTime = Date.now();
    this.lastScaleDownTime = Date.now();
    this.runningTasks = new Map();
  }

  // 启动任务执行器
  async start() {
    // 定期检查任务队列
    setInterval(() => this.processTasks(), 1000);

    // 定期检查是否需要扩展或缩减并发任务数
    setInterval(() => this.adjustConcurrency(), 10000);
  }

  // 处理任务队列
  private async processTasks() {
    // 检查是否有可用的并发槽
    const availableSlots = this.currentConcurrentTasks - this.runningTasks.size;
    if (availableSlots <= 0) return;

    // 获取待处理的任务
    const pendingTasks = await this.getPendingTasks(availableSlots);

    // 执行任务
    for (const task of pendingTasks) {
      this.executeTask(task);
    }
  }
}
```

## Worker进程配置

### 标准Worker

```typescript
// 标准任务处理器
class StandardTaskWorker {
  async processTask(task: any) {
    // 处理标准任务的逻辑
    console.log(`Processing standard task: ${task.id}`);

    // 更新任务状态
    await subtaskQueries.update(task.id, {
      status: 'processing',
      startedAt: new Date()
    });

    try {
      // 执行任务
      const result = await this.executeTask(task);

      // 更新任务结果
      await subtaskQueries.update(task.id, {
        status: 'completed',
        completedAt: new Date(),
        result
      });
    } catch (error) {
      // 处理错误
      await subtaskQueries.update(task.id, {
        status: 'failed',
        error: error.message,
        retryCount: task.retryCount + 1
      });
    }
  }
}
```

### Lumina Worker

```typescript
// Lumina任务处理器
class LuminaTaskWorker {
  async processTask(task: any) {
    // 处理Lumina任务的逻辑
    console.log(`Processing Lumina task: ${task.id}`);

    // 更新任务状态
    await subtaskQueries.update(task.id, {
      status: 'processing',
      startedAt: new Date()
    });

    try {
      // 提交Lumina任务
      const taskUuid = await this.submitLuminaTask(task);

      // 轮询任务状态
      const result = await this.pollLuminaTaskStatus(taskUuid, this.config.luminaConfig.maxAttempts);

      // 更新任务结果
      await subtaskQueries.update(task.id, {
        status: 'completed',
        completedAt: new Date(),
        result
      });
    } catch (error) {
      // 处理错误
      await subtaskQueries.update(task.id, {
        status: 'failed',
        error: error.message,
        retryCount: task.retryCount + 1
      });
    }
  }
}
```

## 动态扩缩容

系统支持基于任务队列长度的动态扩缩容，通过监控待处理任务数量自动调整并发任务数。

```typescript
// 调整并发任务数
private async adjustConcurrency() {
  const now = Date.now();
  const pendingTasksCount = await this.getPendingTasksCount();

  // 扩展并发任务数
  if (
    pendingTasksCount > this.currentConcurrentTasks * 2 &&
    this.currentConcurrentTasks < this.config.maxConcurrentTasks &&
    now - this.lastScaleUpTime > this.config.scaleUpInterval
  ) {
    this.currentConcurrentTasks = Math.min(
      this.currentConcurrentTasks + this.config.tasksPerScaleUp,
      this.config.maxConcurrentTasks
    );
    this.lastScaleUpTime = now;
    console.log(`Scaled up to ${this.currentConcurrentTasks} concurrent tasks`);
  }

  // 缩减并发任务数
  if (
    pendingTasksCount < this.currentConcurrentTasks / 2 &&
    this.currentConcurrentTasks > this.config.initialConcurrentTasks &&
    now - this.lastScaleDownTime > this.config.scaleDownInterval
  ) {
    this.currentConcurrentTasks = Math.max(
      this.currentConcurrentTasks - this.config.tasksPerScaleUp,
      this.config.initialConcurrentTasks
    );
    this.lastScaleDownTime = now;
    console.log(`Scaled down to ${this.currentConcurrentTasks} concurrent tasks`);
  }
}

// 获取待处理任务数量
private async getPendingTasksCount() {
  // 使用Drizzle ORM查询待处理的任务数量
  const result = await db.select({ count: count() })
    .from(subtasks)
    .where(eq(subtasks.status, 'pending'));

  return result[0].count;
}
```

## 任务优先级

系统支持任务优先级，高优先级任务将优先执行。

```typescript
// 提交任务时指定优先级
async function submitTask(taskData: TaskCreateDto, userId: number, priority: number = 1) {
  try {
    // 计算总图片数
    const totalImages = calculateTotalImages(taskData.variables);

    // 创建任务
    const taskId = await taskQueries.create({
      name: taskData.name,
      userId,
      totalImages,
      prompts: taskData.prompts,
      ratio: taskData.ratio,
      seed: taskData.seed,
      batchSize: taskData.batchSize,
      polish: taskData.polish,
      variables: taskData.variables,
      makeApiQueue: taskData.name.toLowerCase().includes('lumina') ? 'dev' : null,
      priority
    });

    // 生成子任务
    const subtasksData = generateSubtasks(taskId, taskData);

    // 批量创建子任务
    await subtaskQueries.createMany(subtasksData);

    // 返回创建的任务
    return await taskQueries.getById(taskId);
  } catch (error) {
    console.error('创建任务失败:', error);
    throw new Error('创建任务失败');
  }
}

// 获取待处理的任务，按优先级排序
async function getPendingTasks(limit: number) {
  return await db.query.subtasks.findMany({
    where: eq(subtasks.status, 'pending'),
    limit,
    orderBy: [
      // 先按任务优先级排序
      sql`(SELECT priority FROM tasks WHERE id = ${subtasks.taskId}) DESC`,
      // 再按创建时间排序
      asc(subtasks.createdAt)
    ]
  });
}
```

## 任务监控

系统提供全面的任务监控功能，包括：

1. **实时状态**：任务的当前状态和进度
2. **执行统计**：任务执行时间、成功率等统计信息
3. **错误报告**：详细的错误信息和堆栈跟踪
4. **性能指标**：待处理任务数量、处理速率等性能指标

```typescript
// 获取系统状态
async function getSystemStatus() {
  // 获取任务统计信息
  const taskStats = await getTaskStats();

  // 获取执行器状态
  const executorStatus = {
    standardTasks: {
      concurrentTasks: taskExecutor.currentConcurrentTasks,
      runningTasks: taskExecutor.runningTasks.size,
      pendingTasks: taskStats.pending.standard
    },
    luminaTasks: {
      concurrentTasks: taskExecutor.luminaConcurrentTasks,
      runningTasks: taskExecutor.luminaRunningTasks.size,
      pendingTasks: taskStats.pending.lumina
    }
  };

  // 获取数据库状态
  const dbStatus = await getDatabaseStatus();

  return {
    status: "healthy",
    uptime: process.uptime(),
    version: process.env.npm_package_version,
    executorStatus,
    taskStats,
    dbStatus
  };
}

// 获取任务统计信息
async function getTaskStats() {
  // 使用Drizzle ORM查询任务统计信息
  const pendingTasks = await db.select({
    total: count(),
    standard: countDistinct(
      and(
        eq(subtasks.status, 'pending'),
        isNull(sql`(SELECT make_api_queue FROM tasks WHERE id = ${subtasks.taskId})`)
      )
    ),
    lumina: countDistinct(
      and(
        eq(subtasks.status, 'pending'),
        eq(sql`(SELECT make_api_queue FROM tasks WHERE id = ${subtasks.taskId})`, 'dev')
      )
    )
  }).from(subtasks).where(eq(subtasks.status, 'pending'));

  const processingTasks = await db.select({ count: count() })
    .from(subtasks)
    .where(eq(subtasks.status, 'processing'));

  const completedTasks = await db.select({ count: count() })
    .from(subtasks)
    .where(eq(subtasks.status, 'completed'));

  const failedTasks = await db.select({ count: count() })
    .from(subtasks)
    .where(eq(subtasks.status, 'failed'));

  // 计算处理速率
  const processingRate = await calculateProcessingRate();

  return {
    pending: {
      total: pendingTasks[0].total,
      standard: pendingTasks[0].standard,
      lumina: pendingTasks[0].lumina
    },
    processing: processingTasks[0].count,
    completed: completedTasks[0].count,
    failed: failedTasks[0].count,
    processingRate
  };
}
```

## 错误处理

系统提供全面的错误处理机制，包括：

1. **自动重试**：任务失败后自动重试，支持指数退避
2. **错误记录**：详细记录错误信息到数据库
3. **错误通知**：任务失败时发送通知
4. **错误分析**：提供错误分析和统计功能

```typescript
// 错误处理
async function handleTaskError(task: any, error: Error) {
  console.error(`Task ${task.id} failed:`, error);

  // 更新任务状态
  await subtaskQueries.update(task.id, {
    status: 'failed',
    error: error.message,
    retryCount: task.retryCount + 1
  });

  // 记录错误到错误日志表
  await db.insert(errorLogs).values({
    errorType: error.name,
    errorMessage: error.message,
    stackTrace: error.stack,
    count: 1,
    firstOccurredAt: new Date(),
    lastOccurredAt: new Date()
  }).onConflictDoUpdate({
    target: [errorLogs.errorType, errorLogs.errorMessage],
    set: {
      count: sql`${errorLogs.count} + 1`,
      lastOccurredAt: new Date()
    }
  });

  // 检查是否需要重试
  if (task.retryCount < 3) {
    // 计算退避时间
    const backoff = Math.pow(2, task.retryCount) * 1000; // 指数退避

    // 延迟重试
    setTimeout(async () => {
      // 重置任务状态为待处理
      await subtaskQueries.update(task.id, {
        status: 'pending'
      });
    }, backoff);
  }
}
```

## 分布式部署

系统支持分布式部署，可以在多台服务器上运行任务执行器，提高处理能力和可靠性。

```
┌─────────────┐     ┌─────────────┐
│  API服务1   │     │  API服务2   │
└─────────────┘     └─────────────┘
       │                  │
       └──────────┬───────┘
                  ▼
          ┌─────────────┐
          │   MongoDB   │
          └─────────────┘
                  │
       ┌──────────┼──────────┐
       │          │          │
       ▼          ▼          ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ 执行器1     │ │ 执行器2     │ │ 执行器3     │
└─────────────┘ └─────────────┘ └─────────────┘
```

分布式部署配置：

```typescript
// 分布式执行器配置
interface DistributedExecutorConfig extends TaskExecutorConfig {
  // 执行器标识
  executorId: string;

  // 执行器组
  executorGroup: string;

  // 心跳间隔（毫秒）
  heartbeatInterval: number;

  // 任务锁定超时（毫秒）
  taskLockTimeout: number;
}

// 分布式执行器实现
class DistributedTaskExecutor extends TaskExecutor {
  private executorId: string;
  private executorGroup: string;
  private heartbeatInterval: number;
  private taskLockTimeout: number;

  constructor(config: DistributedExecutorConfig) {
    super(config);
    this.executorId = config.executorId;
    this.executorGroup = config.executorGroup;
    this.heartbeatInterval = config.heartbeatInterval;
    this.taskLockTimeout = config.taskLockTimeout;
  }

  // 启动执行器
  async start() {
    // 注册执行器
    await this.registerExecutor();

    // 启动心跳
    setInterval(() => this.sendHeartbeat(), this.heartbeatInterval);

    // 启动任务处理
    super.start();
  }

  // 获取待处理任务
  protected async getPendingTasks(limit: number) {
    // 使用乐观锁获取并锁定任务
    return await db.transaction(async (tx) => {
      // 查询待处理任务
      const tasks = await tx.query.subtasks.findMany({
        where: and(
          eq(subtasks.status, 'pending'),
          or(
            isNull(subtasks.workerId),
            lt(subtasks.updatedAt, new Date(Date.now() - this.taskLockTimeout))
          )
        ),
        limit,
        orderBy: [
          sql`(SELECT priority FROM tasks WHERE id = ${subtasks.taskId}) DESC`,
          asc(subtasks.createdAt)
        ]
      });

      // 锁定任务
      for (const task of tasks) {
        await tx.update(subtasks)
          .set({
            workerId: this.executorId,
            updatedAt: new Date()
          })
          .where(eq(subtasks.id, task.id));
      }

      return tasks;
    });
  }
}
```

## 性能优化

1. **批量操作**：使用Drizzle ORM的批量插入和更新功能，减少数据库操作次数
2. **索引优化**：为常用查询字段创建索引，提高查询性能
3. **并发控制**：动态调整并发任务数，优化资源利用
4. **任务分组**：按任务类型分组处理，提高处理效率
5. **数据库连接池**：使用连接池管理数据库连接，减少连接开销

```typescript
// 批量操作示例
async function createSubtasksBatch(subtasksData: any[]) {
  // 批量创建子任务
  const batchSize = 100;
  for (let i = 0; i < subtasksData.length; i += batchSize) {
    const batch = subtasksData.slice(i, i + batchSize);
    await subtaskQueries.createMany(batch);
  }
}

// 索引优化
createIndex('idx_subtasks_status_worker', [subtasks.status, subtasks.workerId]);
createIndex('idx_tasks_status_priority', [tasks.status, tasks.priority]);
```

## 监控和告警

系统提供全面的监控和告警功能，包括：

1. **任务监控**：监控任务执行状态、进度和性能
2. **执行器监控**：监控执行器状态、并发任务数和资源使用
3. **数据库监控**：监控数据库连接、查询性能和存储使用
4. **系统监控**：监控系统资源使用、网络状态和服务健康
5. **告警系统**：当出现异常情况时发送告警通知

```typescript
// 监控API
async function getMonitoringData() {
  const systemStatus = await getSystemStatus();
  const taskStats = await getTaskStats();
  const executorStats = await getExecutorStats();
  const dbStats = await getDatabaseStats();

  // 检查告警条件
  const alerts = checkAlertConditions(systemStatus, taskStats, executorStats, dbStats);

  // 发送告警
  if (alerts.length > 0) {
    await sendAlerts(alerts);
  }

  return {
    systemStatus,
    taskStats,
    executorStats,
    dbStats,
    alerts
  };
}
```
