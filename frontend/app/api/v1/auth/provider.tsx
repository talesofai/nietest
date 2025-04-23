"use client";

import React, { ReactNode } from "react";

import { AuthContext, useAuthProvider } from "./client";

/**
 * 认证提供器属性接口
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * 认证上下文提供器组件
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // 使用自定义钩子获取所有认证状态和方法
  const authState = useAuthProvider();

  return (
    <AuthContext.Provider value={authState}>{children}</AuthContext.Provider>
  );
};
