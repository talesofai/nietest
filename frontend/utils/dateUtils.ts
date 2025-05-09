/**
 * 日期和时间工具函数
 */

/**
 * 将UTC时间转换为北京时间（UTC+8）
 * @param date 日期对象或日期字符串
 * @returns 调整后的日期对象
 */
export function convertToBeijingTime(date: Date | string): Date {
  // 创建日期对象
  const originalDate = typeof date === 'string' ? new Date(date) : new Date(date);
  
  // 获取当前时区偏移（分钟）
  const localOffset = originalDate.getTimezoneOffset();
  
  // 北京时间偏移（UTC+8，即-480分钟）
  const beijingOffset = -480;
  
  // 计算需要调整的分钟数（当前时区到北京时区）
  const offsetDiff = localOffset - beijingOffset;
  
  // 创建新的日期对象，并调整时间
  const beijingDate = new Date(originalDate.getTime() + offsetDiff * 60 * 1000);
  
  return beijingDate;
}

/**
 * 格式化日期为本地字符串，并确保使用北京时间
 * @param date 日期对象或日期字符串
 * @returns 格式化后的日期字符串
 */
export function formatBeijingTime(date: Date | string): string {
  const beijingDate = convertToBeijingTime(date);
  return beijingDate.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * 获取当前北京时间
 * @returns 当前北京时间的日期对象
 */
export function getCurrentBeijingTime(): Date {
  return convertToBeijingTime(new Date());
}

/**
 * 获取当前北京时间的ISO字符串
 * @returns 当前北京时间的ISO字符串
 */
export function getCurrentBeijingTimeISO(): string {
  return getCurrentBeijingTime().toISOString();
}
