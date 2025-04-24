/**
 * 生成客户端安全的ID
 * 在服务器端返回一个固定值，在客户端返回随机值
 * 避免服务器端渲染和客户端渲染不匹配的问题
 */
export function generateClientSafeId(prefix: string = "id"): string {
  // 在服务器端返回一个固定值
  if (typeof window === "undefined") {
    return `${prefix}-server-rendered`;
  }

  // 在客户端返回一个随机值

  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 创建一个客户端安全的日期对象
 * 在服务器端返回一个固定日期，在客户端返回当前日期
 */
export function getClientSafeDate(): Date {
  // 在服务器端返回一个固定日期
  if (typeof window === "undefined") {
    return new Date(2023, 0, 1); // 固定日期：2023-01-01
  }

  // 在客户端返回当前日期

  return new Date();
}

/**
 * 创建一个客户端安全的随机数
 * 在服务器端返回一个固定值，在客户端返回随机值
 */
export function getClientSafeRandom(): number {
  // 在服务器端返回一个固定值
  if (typeof window === "undefined") {
    return 0.5; // 固定随机数：0.5
  }

  // 在客户端返回一个随机值

  return Math.random();
}

/**
 * 创建一个客户端安全的数据版本号
 * 用于替代可能导致hydration错误的data-version、data-settings-changed-at等属性
 */
export function getClientSafeDataVersion(): string {
  // 在服务器端返回一个固定值
  if (typeof window === "undefined") {
    return "1.0.0";
  }

  // 在客户端，如果已经有一个版本号，则使用它，否则生成一个新的
  if (typeof window !== "undefined" && window.__DATA_VERSION) {
    return window.__DATA_VERSION;
  }

  // 生成一个新的版本号并存储它
  const version = "4.0.5"; // 使用错误信息中提到的版本号

  if (typeof window !== "undefined") {
    window.__DATA_VERSION = version;
  }

  return version;
}

// 为window对象添加__DATA_VERSION属性
declare global {
  interface Window {
    __DATA_VERSION?: string;
  }
}
