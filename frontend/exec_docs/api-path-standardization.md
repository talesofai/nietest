# API路径标准化文档

## 问题描述

在API调用中，我们发现存在路径格式不一致的问题，特别是`/api`前缀重复的问题。例如，有些API请求URL为`http://localhost:8000/api/api/v1/tasks`，这是因为基础URL已经包含了`/api`前缀，而路径又添加了一次。

## 解决方案

我们实现了一个`getApiUrl`函数，用于生成完整的API URL，确保所有API请求都使用统一的格式：

```typescript
// 获取完整的API URL
const getApiUrl = (path: string): string => {
  // 处理路径格式
  let processedPath = path;

  // 确保路径以/开头
  if (!processedPath.startsWith('/')) {
    processedPath = `/${processedPath}`;
  }

  // 处理路径中的/api/前缀
  // 如果路径已经包含/api/api/，则移除一个/api/
  if (processedPath.startsWith('/api/api/')) {
    processedPath = processedPath.replace('/api/api/', '/api/');
  }
  // 如果路径已经包含/api/，则不添加/api/
  else if (processedPath.startsWith('/api/')) {
    // 保持不变
  }
  // 如果路径以/v1/开头，则添加/api前缀
  else if (processedPath.startsWith('/v1/')) {
    processedPath = `/api${processedPath}`;
  }
  // 其他情况，确保路径以/api/v1/开头
  else if (!processedPath.startsWith('/api/v1/')) {
    processedPath = `/api/v1${processedPath}`;
  }

  // 确保路径以/结尾（除非包含查询参数或片段标识符）
  if (!processedPath.includes('?') && !processedPath.includes('#') && !processedPath.endsWith('/')) {
    processedPath = `${processedPath}/`;
  }

  // 返回完整URL
  return `${API_BASE_URL}${processedPath}`;
};
```

这个函数确保了所有API URL都符合以下规则：

1. URL包含完整的基础URL和路径
2. 路径以`/api/v1/`开头
3. 路径以`/`结尾（除非包含查询参数或片段标识符）

## 使用方式

在所有API请求中，我们都使用`getApiUrl`函数来生成完整的URL：

```typescript
const response = await axios.get(getApiUrl('/v1/tasks'), { params });
```

这样可以确保所有API请求都使用统一的URL格式，避免路径格式不一致导致的问题。

## 优势

1. **统一性**：所有API请求都使用统一的URL格式，避免了路径格式不一致导致的问题
2. **可维护性**：集中处理URL格式，使代码更易于维护
3. **可扩展性**：如果需要修改URL格式，只需要修改`getApiUrl`函数，而不需要修改所有API请求
4. **可读性**：代码更加清晰，易于理解，不再需要拼接`${API_BASE_URL}`和路径
5. **优雅性**：代码更加优雅，不再有冗长的URL拼接表达式

## 注意事项

1. 确保所有API请求都使用`getApiUrl`函数来生成URL
2. 如果需要修改URL格式，只需要修改`getApiUrl`函数
3. 如果API路径中包含查询参数或片段标识符，不要在路径末尾添加`/`
