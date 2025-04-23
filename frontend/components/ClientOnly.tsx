"use client";

import { useEffect, useState, ReactNode } from "react";

interface ClientOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * 客户端专用组件包装器
 * 
 * 确保包装的内容只在客户端渲染，避免服务器端渲染与客户端渲染不匹配的问题
 * 
 * @param children 子组件
 * @param fallback 服务器端和初始客户端渲染时显示的内容
 */
export default function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // 在服务器端渲染和初始客户端渲染时返回fallback
  if (!isClient) {
    return <>{fallback}</>;
  }

  // 在客户端渲染后返回children
  return <>{children}</>;
}
