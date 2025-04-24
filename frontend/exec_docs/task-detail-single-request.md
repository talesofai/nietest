# 任务详情页面单次请求优化

## 问题描述

在任务详情页面（TaskDetailView组件）中，存在以下问题：

1. 当用户选择不同的x轴和y轴时，组件会重新请求矩阵数据，而不是使用已缓存的数据
2. 这导致了不必要的API请求和服务器负载
3. 用户体验也受到影响，因为每次选择不同的轴都会触发加载状态

## 优化目标

确保任务详情页只请求一次对应的task和matrix数据，然后对于不同的x和y的选择只是基于用户的选择而使用缓存的数据来显示不同的图片。

## 实现方案

### 1. 移除fetchMatrixData函数对xAxis和yAxis的依赖

将fetchMatrixData函数的依赖数组设为空，确保函数不会因为状态变化而重新创建：

```javascript
// 不依赖任何状态，确保函数不会因为状态变化而重新创建
}, []);
```

### 2. 使用ref来跟踪x轴和y轴的选择

添加xAxisRef和yAxisRef来跟踪x轴和y轴的选择，避免在fetchMatrixData函数中直接依赖xAxis和yAxis状态：

```javascript
// 使用ref来跟踪x轴和y轴的选择，避免依赖状态变量
const xAxisRef = useRef<string | null>(null);
const yAxisRef = useRef<string | null>(null);
```

### 3. 同步状态变化到ref

添加useEffect来同步xAxis和yAxis的状态变化到ref中：

```javascript
// 同步xAxis和yAxis的状态变化到ref中
useEffect(() => {
  xAxisRef.current = xAxis;
}, [xAxis]);

useEffect(() => {
  yAxisRef.current = yAxis;
}, [yAxis]);
```

### 4. 在fetchMatrixData函数中使用ref而不是状态

在fetchMatrixData函数中，使用xAxisRef和yAxisRef而不是xAxis和yAxis：

```javascript
// 只在初始加载时设置默认轴，避免覆盖用户选择
// 注意：这里不依赖xAxis和yAxis的当前值，而是使用局部变量currentXAxis和currentYAxis
const currentXAxis = xAxisRef.current;
const currentYAxis = yAxisRef.current;
const shouldSetDefaultAxes = (!currentXAxis && !currentYAxis) || forceRefresh;
```

### 5. 移除不必要的防抖逻辑

由于我们现在只在组件挂载和taskId变化时请求数据，不再需要防抖逻辑：

```javascript
// 移除以下代码
// 使用ref来存储上一次请求的时间戳，用于防抖
const lastRequestTimeRef = useRef<number>(0);
// 防抖时间间隔（毫秒）
const DEBOUNCE_INTERVAL = 500;

// 防抖处理：检查距离上次请求的时间间隔
const now = Date.now();
if (!forceRefresh && now - lastRequestTimeRef.current < DEBOUNCE_INTERVAL) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`请求过于频繁，跳过请求: ${taskId}`);
  }
  return;
}
lastRequestTimeRef.current = now;
```

## 优化效果

通过以上优化，我们确保了任务详情页只请求一次对应的task和matrix数据，然后对于不同的x和y的选择只是基于用户的选择而使用缓存的数据来显示不同的图片。这样可以：

1. 减少不必要的API请求和服务器负载
2. 提高用户体验，因为切换轴不会触发加载状态
3. 减少网络流量和数据传输
4. 提高页面响应速度

## 后续优化建议

1. 考虑使用React Query或SWR等库来管理API请求和缓存
2. 添加数据预取功能，在用户浏览任务列表时预取可能需要的矩阵数据
3. 添加错误重试机制，在请求失败时自动重试
4. 考虑添加数据过期逻辑，在数据过期后自动刷新
5. 优化图片加载，使用懒加载和渐进式加载提高用户体验
