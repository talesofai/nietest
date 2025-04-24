# 依赖报告

## 未使用的依赖

以下依赖在代码中未被直接引用，但可能通过其他方式被使用：

1. `@dnd-kit/utilities` - 可能被 `@dnd-kit/sortable` 或 `@dnd-kit/core` 间接使用
2. `@heroui/code` - 可能在某些组件中被间接使用
3. `@heroui/listbox` - 可能在某些组件中被间接使用
4. `@heroui/snippet` - 可能在某些组件中被间接使用
5. `intl-messageformat` - 可能用于国际化支持
6. `react-draggable` - 可能被其他拖拽相关组件替代
7. `@cloudflare/next-on-pages` - 可能用于部署配置
8. `@react-types/shared` - 可能被其他 React Aria 组件间接使用
9. `autoprefixer` - 用于 CSS 处理，在构建过程中使用
10. `eslint-config-next` - 用于 ESLint 配置
11. `lint-staged` - 可能用于 Git 钩子
12. `npm-check` - 用于依赖检查
13. `postcss` - 用于 CSS 处理
14. `rimraf` - 可能用于清理脚本

## 缺失的依赖

以下依赖在代码中被使用，但未在 package.json 中声明：

1. `@heroui/shared-icons` - 在 `components/tags/draggable/modals/AddTagForm.tsx` 中使用
2. `@heroui/card` - 在 `app/login/page.tsx` 中使用

## 可更新的依赖

项目中有多个依赖可以更新到更新的版本，包括：

### 补丁更新
- `@heroui/button`: 2.2.16 → 2.2.17
- `@heroui/input`: 2.4.16 → 2.4.17
- `@heroui/kbd`: 2.2.12 → 2.2.13
- `@heroui/link`: 2.2.13 → 2.2.14
- `@heroui/listbox`: 2.3.15 → 2.3.16
- `@heroui/navbar`: 2.2.14 → 2.2.15
- `@heroui/snippet`: 2.2.17 → 2.2.18
- `@heroui/switch`: 2.2.14 → 2.2.15
- `@heroui/system`: 2.4.12 → 2.4.13
- `@heroui/theme`: 2.4.12 → 2.4.13
- `@react-aria/ssr`: 3.9.7 → 3.9.8
- `@react-aria/visually-hidden`: 3.8.20 → 3.8.22
- `autoprefixer`: 10.4.19 → 10.4.21
- `eslint-plugin-prettier`: 5.2.1 → 5.2.6

### 次要更新
- `next`: 15.0.4 → 15.3.1
- `@next/eslint-plugin-next`: 15.0.4 → 15.3.1
- `@react-types/shared`: 3.25.0 → 3.29.0
- `@typescript-eslint/eslint-plugin`: 8.11.0 → 8.31.0
- `@typescript-eslint/parser`: 8.11.0 → 8.31.0
- `eslint-config-next`: 15.0.4 → 15.3.1
- `postcss`: 8.4.49 → 8.5.3
- `prettier`: 3.3.3 → 3.5.3
- `typescript`: 5.6.3 → 5.8.3

### 主要更新
- `framer-motion`: 11.13.1 → 12.8.0
- `react`: 18.3.1 → 19.1.0
- `react-dom`: 18.3.1 → 19.1.0
- `@types/node`: 20.5.7 → 22.14.1
- `@types/react`: 18.3.3 → 19.1.2
- `@types/react-dom`: 18.3.0 → 19.1.2
- `eslint`: 8.57.1 → 9.25.1
- `eslint-config-prettier`: 9.1.0 → 10.1.2
- `eslint-plugin-react-hooks`: 4.6.2 → 5.2.0
- `rimraf`: 5.0.10 → 6.0.1
- `tailwind-variants`: 0.3.0 → 1.0.0
- `tailwindcss`: 3.4.16 → 4.1.4

**注意**：主要版本更新可能包含破坏性变更，应谨慎进行。
