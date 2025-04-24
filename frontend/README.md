# Next.js 应用模板

这是一个基于 Next.js 的应用模板，集成了多种工具和最佳实践，以提高开发效率和代码质量。

## 特性

- 🚀 [Next.js](https://nextjs.org/) - React 框架
- 🎨 [Tailwind CSS](https://tailwindcss.com/) - 实用优先的 CSS 框架
- 📏 [ESLint](https://eslint.org/) - 代码质量检查
- 💖 [Prettier](https://prettier.io/) - 代码格式化
- 🔍 [TypeScript](https://www.typescriptlang.org/) - 静态类型检查
- 🐶 [Husky](https://typicode.github.io/husky/) - Git 钩子
- 🚫 [lint-staged](https://github.com/okonet/lint-staged) - 对暂存的 Git 文件运行 linters

## 开始使用

### 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

### 构建

```bash
# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start
```

### 代码质量

```bash
# 运行 ESLint
pnpm lint

# 修复 ESLint 问题
pnpm lint:fix

# 严格模式运行 ESLint（不允许警告）
pnpm lint:strict

# 格式化代码
pnpm format

# 类型检查
pnpm type-check

# 运行全面代码质量检查（ESLint、TypeScript、依赖检查）
pnpm check

# 仅运行 ESLint 检查
pnpm check:eslint

# 仅运行类型检查
pnpm check:types

# 仅运行依赖检查
pnpm check:deps
```

### 代码质量报告

```bash
# 生成所有报告（ESLint、代码复杂度、依赖分析）
pnpm report

# 仅生成 ESLint 报告
pnpm report:eslint

# 仅生成代码复杂度报告
pnpm report:complexity

# 仅生成依赖分析报告
pnpm report:deps
```

生成的报告将保存在 `reports/` 目录中。

## 项目结构

```
/
├── app/                # Next.js 应用目录
├── components/         # React 组件
├── config/             # 配置文件
├── hooks/              # React 钩子
├── lib/                # 工具库
├── public/             # 静态资源
├── styles/             # 全局样式
├── types/              # TypeScript 类型定义
└── utils/              # 工具函数
```

## 代码规范与质量保证

本项目使用多种工具来保证代码质量和一致性：

> **注意：** `example` 目录包含专业前端开发者搭建的架构参考，已被排除在代码质量检查之外。

- **ESLint**: 用于代码质量和风格检查，集成了多种插件：
  - sonarjs: 检测代码中的潜在问题和复杂度
  - security: 检测安全问题
  - promise: 确保 Promise 的正确使用
  - optimize-regex: 优化正则表达式
  - no-unsanitized: 防止 XSS 漏洞

- **Prettier**: 用于代码格式化，确保代码风格一致。

- **TypeScript**: 提供静态类型检查，减少运行时错误。

- **Husky**: 管理 Git 钩子，在代码提交和推送前运行检查。
  - pre-commit: 运行 lint-staged，检查和格式化暂存的文件
  - pre-push: 运行全面代码质量检查

- **lint-staged**: 对暂存的 Git 文件运行检查和格式化。

- **代码质量报告**: 生成详细的代码质量报告，包括 ESLint、代码复杂度和依赖分析。

### 开发流程

1. 开发新功能或修复 bug
2. 运行 `pnpm check` 检查代码质量
3. 使用 `pnpm lint:fix` 和 `pnpm format` 修复问题
4. 提交代码（会自动运行 lint-staged）
5. 推送代码（会自动运行全面代码质量检查）

> 注意：如果代码质量检查失败，推送将被阻止。请修复问题后再次推送。

## 许可证

[MIT](LICENSE)
