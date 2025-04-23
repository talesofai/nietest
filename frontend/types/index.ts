import { SVGProps } from  "react";

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

// 导出 API 相关类型
export * from "./api";

// 导出搜索相关类型
export * from "./search";

// 导出标签相关类型
export * from "./tag";

// 导出变量相关类型
export * from "./variable";

// 导出任务相关类型
export * from "./task";

// 导出令牌相关类型（包含角色和元素类型定义）
export * from "./vtoken";
