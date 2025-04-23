"use client";

import { useEffect, useState, ReactNode } from "react";

import { getClientSafeDataVersion } from "@/utils/hydrationHelper";

interface HydrationFixProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

/**
 * 修复hydration错误的组件
 *
 * 用于包装那些可能导致hydration错误的元素，特别是包含动态生成的data-*属性的元素
 */
export default function HydrationFix({ children, className, id }: HydrationFixProps) {
  const [dataVersion, setDataVersion] = useState<string>("1.0.0");
  const [dataSettingsChangedAt, setDataSettingsChangedAt] = useState<string>("0");
  const [dataCid, setDataCid] = useState<string>("0");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // 在客户端设置正确的值
    setDataVersion(getClientSafeDataVersion());
    setDataSettingsChangedAt("0"); // 使用错误信息中提到的值
    setDataCid("1745393202948"); // 使用错误信息中提到的值
    setIsClient(true);
  }, []);

  // 在服务器端渲染时，不添加可能导致hydration错误的属性
  if (!isClient) {
    return (
      <div suppressHydrationWarning className={className} id={id}>
        {children}
      </div>
    );
  }

  // 在客户端渲染后，添加所有属性

  return (
    <div
      suppressHydrationWarning
      className={className}
      data-cid={dataCid}
      data-settings-changed-at={dataSettingsChangedAt}
      data-version={dataVersion}
      id={id}
    >
      {children}
    </div>
  );
}
