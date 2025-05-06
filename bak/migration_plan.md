# 迁移计划

## 概述

本文档详细描述了从现有MongoDB后端系统迁移到新的PostgreSQL后端系统的计划。迁移将分阶段进行，确保系统平稳过渡，同时保持服务的连续性。

## 迁移目标

1. **数据库迁移**：从MongoDB迁移到PostgreSQL
2. **任务处理系统迁移**：从自定义任务执行器迁移到Dramatiq
3. **代码重构**：优化代码结构，提高可维护性
4. **性能优化**：提高系统整体性能
5. **功能增强**：增加新功能，如子任务评分和评价

## 迁移阶段

### 阶段一：准备工作（2周）

1. **环境搭建**
   - 设置开发环境
   - 安装PostgreSQL和Redis
   - 配置Dramatiq

2. **数据库设计**
   - 设计PostgreSQL数据库模型
   - 创建数据库迁移脚本
   - 设计数据转换策略

3. **API兼容性规划**
   - 分析现有API
   - 设计兼容层
   - 规划API版本策略

### 阶段二：核心功能实现（4周）

1. **数据库模型实现**
   - 实现用户模型
   - 实现任务模型
   - 实现子任务模型

2. **基础API实现**
   - 实现认证API
   - 实现用户管理API
   - 实现任务管理API

3. **任务处理系统实现**
   - 实现Dramatiq任务
   - 实现任务队列管理
   - 实现任务监控

### 阶段三：数据迁移（2周）

1. **数据导出**
   - 从MongoDB导出用户数据
   - 从MongoDB导出任务数据
   - 从MongoDB导出子任务数据

2. **数据转换**
   - 转换用户数据格式
   - 转换任务数据格式
   - 转换子任务数据格式

3. **数据导入**
   - 导入用户数据到PostgreSQL
   - 导入任务数据到PostgreSQL
   - 导入子任务数据到PostgreSQL

4. **数据验证**
   - 验证数据完整性
   - 验证数据一致性
   - 修复数据问题

### 阶段四：测试和优化（3周）

1. **单元测试**
   - 编写模型测试
   - 编写服务测试
   - 编写API测试

2. **集成测试**
   - 测试API和数据库集成
   - 测试任务处理系统
   - 测试系统整体功能

3. **性能测试**
   - 测试API性能
   - 测试数据库性能
   - 测试任务处理性能

4. **优化**
   - 优化数据库查询
   - 优化API响应时间
   - 优化任务处理效率

### 阶段五：部署和监控（1周）

1. **部署准备**
   - 准备部署环境
   - 配置负载均衡
   - 设置监控系统

2. **灰度发布**
   - 部署到测试环境
   - 进行灰度测试
   - 收集反馈并调整

3. **全面部署**
   - 部署到生产环境
   - 监控系统性能
   - 处理潜在问题

4. **文档和培训**
   - 更新技术文档
   - 更新用户文档
   - 进行团队培训

## 数据迁移策略

### 用户数据迁移

1. **导出MongoDB用户数据**

```bash
mongoexport --uri="mongodb://username:password@host:port/database" --collection=users --out=users.json
```

2. **转换用户数据**

```python
import json
import uuid
from datetime import datetime

# 读取MongoDB导出的用户数据
with open('users.json', 'r') as f:
    users = [json.loads(line) for line in f]

# 转换为PostgreSQL格式
pg_users = []
for user in users:
    pg_user = {
        "id": str(uuid.uuid4()),
        "email": user.get("email"),
        "hashed_password": user.get("hashed_password"),
        "fullname": user.get("fullname"),
        "roles": user.get("roles", ["user"]),
        "is_active": user.get("is_active", True),
        "created_at": user.get("created_at", datetime.utcnow().isoformat()),
        "updated_at": user.get("updated_at", datetime.utcnow().isoformat())
    }
    pg_users.append(pg_user)

# 保存为PostgreSQL导入格式
with open('pg_users.json', 'w') as f:
    json.dump(pg_users, f, indent=2)
```

3. **导入PostgreSQL**

```bash
psql -U username -d database -c "\copy users FROM 'pg_users.json' WITH (FORMAT json, FREEZE)"
```

### 任务数据迁移

1. **导出MongoDB任务数据**

```bash
mongoexport --uri="mongodb://username:password@host:port/database" --collection=tasks --out=tasks.json
```

2. **转换任务数据**

```python
import json
import uuid
from datetime import datetime

# 读取MongoDB导出的任务数据
with open('tasks.json', 'r') as f:
    tasks = [json.loads(line) for line in f]

# 转换为PostgreSQL格式
pg_tasks = []
for task in tasks:
    pg_task = {
        "id": task.get("id") or str(uuid.uuid4()),
        "task_name": task.get("task_name"),
        "username": task.get("username"),
        "tags": task.get("tags", []),
        "variables": task.get("variables", {}),
        "settings": task.get("settings", {}),
        "status": task.get("status", "pending"),
        "created_at": task.get("created_at", datetime.utcnow().isoformat()),
        "updated_at": task.get("updated_at", datetime.utcnow().isoformat()),
        "total_images": task.get("total_images", 0),
        "all_subtasks_completed": task.get("all_subtasks_completed", False),
        "is_deleted": task.get("is_deleted", False),
        "priority": task.get("priority", 1)
    }
    pg_tasks.append(pg_task)

# 保存为PostgreSQL导入格式
with open('pg_tasks.json', 'w') as f:
    json.dump(pg_tasks, f, indent=2)
```

3. **导入PostgreSQL**

```bash
psql -U username -d database -c "\copy tasks FROM 'pg_tasks.json' WITH (FORMAT json, FREEZE)"
```

### 子任务数据迁移

1. **导出MongoDB子任务数据**

```bash
mongoexport --uri="mongodb://username:password@host:port/database" --collection=dramatiq_tasks --out=subtasks.json
```

2. **转换子任务数据**

```python
import json
import uuid
from datetime import datetime

# 读取MongoDB导出的子任务数据
with open('subtasks.json', 'r') as f:
    subtasks = [json.loads(line) for line in f]

# 转换为PostgreSQL格式
pg_subtasks = []
for subtask in subtasks:
    pg_subtask = {
        "id": subtask.get("id") or str(uuid.uuid4()),
        "parent_task_id": subtask.get("parent_task_id"),
        "variable_indices": subtask.get("variable_indices", [None, None, None, None, None, None]),
        "variable_types_map": subtask.get("variable_types_map", {}),
        "type_to_variable": subtask.get("type_to_variable", {}),
        "status": subtask.get("status", "pending"),
        "result": subtask.get("result"),
        "error": subtask.get("error"),
        "retry_count": subtask.get("retry_count", 0),
        "prompts": subtask.get("prompts", []),
        "ratio": subtask.get("ratio", "1:1"),
        "seed": subtask.get("seed"),
        "use_polish": subtask.get("use_polish", False),
        "created_at": subtask.get("created_at", datetime.utcnow().isoformat()),
        "updated_at": subtask.get("updated_at", datetime.utcnow().isoformat()),
        "rating": None,  # 新增字段
        "evaluate": None  # 新增字段
    }
    pg_subtasks.append(pg_subtask)

# 保存为PostgreSQL导入格式
with open('pg_subtasks.json', 'w') as f:
    json.dump(pg_subtasks, f, indent=2)
```

3. **导入PostgreSQL**

```bash
psql -U username -d database -c "\copy subtasks FROM 'pg_subtasks.json' WITH (FORMAT json, FREEZE)"
```

## API兼容性策略

为确保现有前端应用能够无缝对接新后端，我们将采用以下API兼容性策略：

1. **保持API路径不变**：保持现有API路径不变，确保前端应用不需要修改API调用路径。

2. **保持请求格式不变**：保持现有请求格式不变，确保前端应用不需要修改请求数据结构。

3. **保持响应格式不变**：保持现有响应格式不变，确保前端应用不需要修改响应数据处理逻辑。

4. **兼容层**：在必要时实现兼容层，将新系统的数据结构转换为旧系统的数据结构。

5. **版本控制**：使用API版本控制，允许同时支持多个API版本，便于未来升级。

## 风险和缓解措施

### 数据丢失风险

**风险**：在数据迁移过程中可能发生数据丢失。

**缓解措施**：
- 在迁移前进行完整备份
- 使用事务确保数据一致性
- 实施数据验证和修复机制
- 保留原始数据库一段时间，以便在必要时恢复

### 性能下降风险

**风险**：新系统可能在初期出现性能下降。

**缓解措施**：
- 在部署前进行全面的性能测试
- 实施数据库索引优化
- 使用缓存减少数据库负载
- 监控系统性能，及时调整配置

### 兼容性问题风险

**风险**：新系统可能与现有前端应用存在兼容性问题。

**缓解措施**：
- 实施严格的API兼容性测试
- 使用兼容层处理数据格式差异
- 提供详细的API文档
- 灰度发布，逐步切换流量

### 服务中断风险

**风险**：迁移过程可能导致服务中断。

**缓解措施**：
- 选择低峰期进行迁移
- 实施蓝绿部署策略
- 准备回滚计划
- 提前通知用户可能的服务中断

## 回滚计划

如果迁移过程中出现严重问题，我们将实施以下回滚计划：

1. **停止新系统**：立即停止新系统的所有服务。

2. **恢复旧系统**：启动旧系统的所有服务。

3. **恢复数据**：如果有必要，从备份恢复数据。

4. **切换流量**：将流量切换回旧系统。

5. **通知用户**：通知用户服务已恢复，并说明情况。

6. **分析问题**：分析导致回滚的问题，制定解决方案。

## 迁移后验证

迁移完成后，我们将进行以下验证：

1. **功能验证**：验证所有功能是否正常工作。

2. **性能验证**：验证系统性能是否符合预期。

3. **数据验证**：验证数据是否完整和一致。

4. **安全验证**：验证系统安全性是否符合要求。

5. **用户体验验证**：收集用户反馈，验证用户体验是否良好。

## 迁移时间表

| 阶段 | 开始日期 | 结束日期 | 负责人 |
|------|----------|----------|--------|
| 准备工作 | 2023-05-01 | 2023-05-14 | 项目经理 |
| 核心功能实现 | 2023-05-15 | 2023-06-11 | 开发团队 |
| 数据迁移 | 2023-06-12 | 2023-06-25 | 数据库管理员 |
| 测试和优化 | 2023-06-26 | 2023-07-16 | 测试团队 |
| 部署和监控 | 2023-07-17 | 2023-07-23 | 运维团队 |

## 迁移后运维

迁移完成后，我们将实施以下运维措施：

1. **监控**：持续监控系统性能和稳定性。

2. **备份**：定期备份数据库和配置。

3. **更新**：定期更新系统组件和依赖。

4. **优化**：根据监控数据持续优化系统。

5. **安全**：定期进行安全审计和漏洞扫描。

## 结论

通过本迁移计划，我们将实现从MongoDB到PostgreSQL的平稳过渡，同时提高系统性能和可维护性。迁移将分阶段进行，确保系统稳定性和服务连续性。
