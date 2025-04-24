# API调用修复文档

## 问题描述

在API调用中，我们发现了以下问题：

1. **API路径不一致**：有些地方使用`/api/v1/`，有些地方使用`/v1/`
2. **认证问题**：有些API调用没有添加Bearer认证
3. **重复的API前缀**：有些API调用URL中有重复的`/api`前缀
4. **直接使用fetch/axios**：有些地方直接使用fetch或axios调用API，而不是使用统一的apiService
5. **引号风格不一致**：有些地方使用单引号 `'`，有些地方使用双引号 `"`

## 解决方案

我们实施了以下修复：

1. **统一API基础URL**：
   - 在`apiService.ts`和`apiClient.ts`中，将`baseURL`设置为`${API_BASE_URL}/api/v1`
   - 这样所有的API调用路径都是相对于这个基础URL的，不需要再添加`/api/v1`前缀

2. **统一API路径格式**：
   - 修改所有API调用路径，去掉`/api/v1`前缀，因为已经在`baseURL`中添加了这个前缀
   - 例如：`/api/v1/tasks` -> `/tasks`

3. **添加Bearer认证**：
   - 确保所有需要认证的API调用都添加了Bearer认证
   - 在`apiService.ts`和`apiClient.ts`中，添加请求拦截器，自动添加Bearer认证头

4. **修复直接使用fetch/axios的地方**：
   - 修改`vtokenService.ts`中的`validateXToken`函数，使用完整的API URL并添加Bearer认证
   - 修改`app/static-test/page.tsx`中的`testApiConnection`函数，使用正确的API路径格式

5. **统一引号风格**：
   - 将所有字符串引号统一为单引号 `'`
   - 特别是在对象属性和字符串值中，保持一致的引号风格

## 修改的文件

1. `utils/api/apiService.ts`：
   - 修改`baseURL`为`${API_BASE_URL}/api/v1`
   - 修改所有API调用路径，去掉`/api/v1`前缀
   - 确保所有需要认证的API调用都添加了Bearer认证
   - 统一使用单引号风格

2. `utils/apiClient.ts`：
   - 修改`baseURL`为`${API_BASE_URL}/api/v1`
   - 修改`processUrl`函数，处理路径中的`/api/v1`前缀
   - 修改`loginApi`函数，使用正确的API路径格式
   - 统一使用单引号风格
   - 修改所有API函数，去掉路径中的`/api/v1`前缀

3. `utils/vtokenService.ts`：
   - 修改`validateXToken`函数，使用完整的API URL并添加Bearer认证
   - 统一使用单引号风格
   - 修改请求头属性，使用单引号

4. `app/static-test/page.tsx`：
   - 修改`testApiConnection`函数，使用正确的API路径格式

## 后续建议

1. **统一使用apiService**：
   - 所有API调用都应该使用`apiService`，避免直接使用fetch或axios
   - 如果需要添加新的API调用，应该在`apiService.ts`中添加，然后在其他地方导入使用

2. **添加API调用文档**：
   - 为所有API调用添加详细的文档，包括参数、返回值、错误处理等
   - 这样可以方便其他开发者了解和使用API

3. **添加API调用测试**：
   - 为所有API调用添加单元测试，确保它们正常工作
   - 这样可以在修改API调用时，及时发现问题

4. **添加API调用缓存**：
   - 对于频繁调用的API，可以添加缓存机制，减少服务器负担
   - 例如，可以使用React Query或SWR来实现缓存

5. **添加API调用错误处理**：
   - 为所有API调用添加统一的错误处理机制
   - 例如，可以使用全局的错误处理组件，显示友好的错误信息
