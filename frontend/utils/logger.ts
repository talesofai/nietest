/**
 * 日志工具函数
 * 只在开发环境下输出日志，生产环境不输出
 */

/**
 * 输出普通日志
 * @param message 日志消息
 * @param args 其他参数
 */
export const log = (message: string, ...args: any[]): void => {
  if (process.env.NODE_ENV === "development") {
    // 在开发环境下输出日志
    // eslint-disable-next-line no-console
    console.log(message, ...args);
  }
};

/**
 * 输出错误日志
 * @param message 错误消息
 * @param args 其他参数
 */
export const error = (message: string, ...args: any[]): void => {
  if (process.env.NODE_ENV === "development") {
    // 在开发环境下输出错误日志
    // eslint-disable-next-line no-console
    console.error(message, ...args);
  }
};

/**
 * 输出警告日志
 * @param message 警告消息
 * @param args 其他参数
 */
export const warn = (message: string, ...args: any[]): void => {
  if (process.env.NODE_ENV === "development") {
    // 在开发环境下输出警告日志
    // eslint-disable-next-line no-console
    console.warn(message, ...args);
  }
};
