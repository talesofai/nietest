# Backend2 重构计划

## 项目概述

Backend2 是对现有后端系统的全面重构，旨在提高性能、可维护性和可扩展性。新系统将采用MongoDB数据库，并使用Drizzle ORM实现数据访问层，以实现更高效的任务处理和更好的类型安全性。

## 重构目标

1. **提高系统性能**：优化数据库结构和查询，提高API响应速度
2. **增强可扩展性**：支持水平扩展和分布式部署
3. **改进代码质量**：规范化代码结构，减少复杂性
4. **增强任务处理能力**：使用自定义任务执行器，优化任务队列管理
5. **优化数据存储**：使用MongoDB，并通过Drizzle ORM提供类型安全的数据访问

## 技术栈

- **Web框架**：Express/Next.js API Routes
- **数据库**：MongoDB
- **ORM**：Drizzle ORM
- **任务队列**：自定义任务执行器
- **认证**：JWT
- **文档**：OpenAPI/Swagger
- **语言**：TypeScript

## 架构设计

系统将采用分层架构，清晰分离关注点：

1. **API层**：处理HTTP请求和响应
2. **服务层**：实现业务逻辑
3. **数据访问层**：使用Drizzle ORM处理数据库操作
4. **任务处理层**：管理异步任务执行

系统将支持水平扩展，API服务和任务处理服务可以独立部署和扩展。

## 数据库设计

使用MongoDB作为主数据库，通过Drizzle ORM提供类型安全的数据访问。主要集合包括：

- **users**：用户信息
- **tasks**：任务信息
- **subtasks**：子任务信息
- **system_stats**：系统统计信息
- **error_logs**：错误日志

Drizzle ORM提供了强类型的数据模型定义，使得数据访问更加安全和可靠。

## 任务处理系统

自定义任务执行器具有以下特点：

1. **动态并发控制**：根据任务数量动态调整并发执行的任务数
2. **优先级支持**：支持任务优先级，高优先级任务优先执行
3. **任务分类**：支持不同类型的任务队列（标准任务、Lumina任务等）
4. **错误处理**：内置重试机制和错误处理
5. **监控和统计**：提供任务执行统计和监控功能
6. **资源控制**：自动扩展和缩减并发任务数量，优化资源利用

## 实施计划

1. **阶段一**：设计数据库模型和Drizzle ORM实现
2. **阶段二**：实现核心API和服务
3. **阶段三**：实现自定义任务执行器
4. **阶段四**：测试和性能优化
5. **阶段五**：部署和监控

## 兼容性考虑

新系统将保持API兼容性，确保现有前端应用可以无缝对接。

## Drizzle ORM实现

Drizzle ORM的实现位于`app/db/drizzle`目录下，包含以下文件：

- **schema.ts**：数据库表结构定义
- **config.ts**：Drizzle配置和数据库连接
- **queries.ts**：常用查询函数
- **index.ts**：导出所有模块

使用示例：

```typescript
// 导入数据库实例和查询函数
import { db, userQueries, taskQueries, subtaskQueries } from '../db/drizzle';

// 使用查询函数
async function getUserById(id: number) {
  const user = await userQueries.getById(id);
  return user;
}

// 使用db实例进行自定义查询
import { eq } from 'drizzle-orm';
import { users } from '../db/drizzle/schema';

async function customQuery() {
  const result = await db.select().from(users).where(eq(users.role, 'admin'));
  return result;
}
```
