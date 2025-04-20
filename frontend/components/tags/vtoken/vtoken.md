# VToken 组件库文档

VToken 组件库是一套用于处理虚拟资源（Virtual Token，简称VToken）相关操作的组件集合，提供了对角色(Character)和元素(Element)这两种资源的显示、管理、选择和搜索功能。这些组件可以用于构建需要选择和展示这些资源的界面。

## 组件概览

| 组件名称 | 功能描述 |
|---------|---------|
| `VTokenDisplay` | 显示角色或元素的基本信息，包括图标/头像和名称 |
| `VTokenManager` | 管理API访问凭据，用于获取角色和元素资源 |
| `VTokenSelector` | 选择角色或元素，并显示当前选中项目 |
| `VTokenSearchModal` | 提供搜索功能的模态框，用于搜索角色或元素 |

## 详细组件说明

### 1. VTokenDisplay

**文件:** `VTokenDisplay.tsx`

**功能:** 显示角色或元素的基本信息，包括头像、名称等

**主要特性:**
- 支持显示头像/图标
- 支持显示名称
- 可配置关闭按钮
- 可配置点击事件
- 支持自定义图标
- 支持禁用状态

**示例用法:**
```jsx
<VTokenDisplay
  name="角色名称"
  type="character"
  header_img="头像URL"
  onClose={() => handleClose()}
  onClick={() => handleClick()}
/>
```

### 2. VTokenManager

**文件:** `VTokenManager.tsx`

**功能:** 提供API访问凭据的设置、验证和显示功能，用于获取角色和元素资源

**主要特性:**
- 支持保存API凭据到本地存储
- 支持验证API凭据的有效性
- 支持清除API凭据
- 可展开/收起的界面
- 具有凭据状态指示器
- 提供凭据变更回调

**示例用法:**
```jsx
<VTokenManager
  onTokenChange={(token) => handleTokenChange(token)}
  defaultExpanded={true}
/>
```

### 3. VTokenSelector

**文件:** `VTokenSelector.tsx`

**功能:** 用于选择角色或元素，并显示当前选中的项目

**主要特性:**
- 集成了VTokenDisplay和搜索模态框
- 支持角色和元素两种类型
- 支持回调函数获取选择结果
- 支持禁用状态
- 支持自定义样式

**示例用法:**
```jsx
<VTokenSelector
  type="character"
  name={selectedCharacter?.name}
  header_img={selectedCharacter?.header_img}
  onChange={(value) => console.log("Selected:", value)}
  onSelectItem={(item) => setSelectedCharacter(item)}
/>
```

### 4. VTokenSearchModal

**文件:** `VTokenSearchModal.tsx`

**功能:** 提供搜索功能的模态框，用于搜索角色或元素

**主要特性:**
- 支持关键词搜索
- 支持分页显示结果
- 显示搜索结果的热度信息
- 提供错误处理和加载状态
- 支持按回车键搜索
- 响应式布局适配不同屏幕尺寸

**派生组件:**
- `CharacterSearchModal`: 专用于角色搜索的模态框
- `ElementSearchModal`: 专用于元素搜索的模态框

**示例用法:**
```jsx
<CharacterSearchModal
  isOpen={isOpen}
  onClose={onClose}
  onSelect={(item) => handleSelect(item)}
/>
```

## 使用场景

1. **资源访问授权**：使用`VTokenManager`管理用户的API访问凭据
2. **角色选择**：在创建内容时使用`VTokenSelector`选择相关角色
3. **元素标记**：在内容编辑时使用`VTokenSelector`标记相关元素
4. **资源展示**：使用`VTokenDisplay`在页面上展示已选择的角色或元素

## 完整示例

查看`VTokenDemo.tsx`获取完整的使用示例，展示了各组件的功能和用法。