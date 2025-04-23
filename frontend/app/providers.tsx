"use client";

import type { ThemeProviderProps } from "next-themes";

import * as React from "react";
import { useState, useEffect } from "react";
import { HeroUIProvider } from "@heroui/system";
import { useRouter } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";

import { AuthProvider } from "@/lib/auth";

export interface ProvidersProps {
  children: React.ReactNode;
  themeProps?: ThemeProviderProps;
}

declare module "@react-types/shared" {
  interface RouterConfig {
    routerOptions: NonNullable<
      Parameters<ReturnType<typeof useRouter>["push"]>[1]
    >;
  }
}

/**
 * 应用程序提供器组件
 *
 * 提供主题、认证、Alert通知和UI库的上下文
 */
export function Providers({ children, themeProps }: ProvidersProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // 在客户端挂载后设置mounted为true
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <HeroUIProvider navigate={router.push}>
      <NextThemesProvider {...themeProps}>
        <AuthProvider>
          {/* 使用div包装并添加suppressHydrationWarning属性 */}
          <div suppressHydrationWarning>
            {/* 在服务器端渲染和初始客户端渲染时，渲染一个占位符 */}
            {!mounted ? (
              <div style={{ visibility: "hidden" }}>{children}</div>
            ) : (
              children
            )}
          </div>
        </AuthProvider>
      </NextThemesProvider>
    </HeroUIProvider>
  );
}
