"use client";

import { useState, useCallback } from "react";

/**
 * Alert通知选项接口
 */
export interface AlertOptions {
  title: string;
  description: string;
  variant?: "solid" | "bordered" | "flat" | "faded";
  color?: "default" | "primary" | "secondary" | "success" | "warning" | "danger";
  autoHideDuration?: number;
}

/**
 * 使用Alert通知的自定义钩子
 *
 * 提供简便的方法来显示不同类型的通知
 */
export const useAlert = () => {
  const [alertState, setAlertState] = useState<{
    isVisible: boolean;
    title: string;
    description: string;
    variant: "solid" | "bordered" | "flat" | "faded";
    color: "default" | "primary" | "secondary" | "success" | "warning" | "danger";
    autoHideDuration: number;
  }>({
    isVisible: false,
    title: "",
    description: "",
    variant: "flat",
    color: "default",
    autoHideDuration: 5000,
  });

  /**
   * 关闭Alert通知
   */
  const hideAlert = useCallback(() => {
    setAlertState((prev) => ({ ...prev, isVisible: false }));
  }, []);

  /**
   * 显示Alert通知
   * @param options Alert选项
   */
  const showAlert = useCallback((options: AlertOptions) => {
    try {
      setAlertState({
        isVisible: true,
        title: options.title,
        description: options.description,
        variant: options.variant || "flat",
        color: options.color || "default",
        autoHideDuration: options.autoHideDuration || 5000,
      });

      // 同时在控制台记录消息
      // eslint-disable-next-line no-console
      console.log(
        `${options.color === "danger" ? "错误" : "成功"}: ${options.title} - ${options.description}`
      );
    } catch (error) {
      // 如果出错，回退到控制台日志
      // eslint-disable-next-line no-console
      // eslint-disable-next-line no-console
      // eslint-disable-next-line no-console
      console.error("无法显示Alert通知:", error);
      // eslint-disable-next-line no-console
      console.log(
        `${options.color === "danger" ? "错误" : "成功"}: ${options.title} - ${options.description}`
      );
    }
  }, []);

  /**
   * 显示成功通知
   * @param title 标题
   * @param description 描述
   */
  const success = useCallback(
    (title: string, description: string) => {
      showAlert({
        title,
        description,
        color: "success",
      });
    },
    [showAlert]
  );

  /**
   * 显示错误通知
   * @param title 标题
   * @param description 描述
   */
  const error = useCallback(
    (title: string, description: string) => {
      showAlert({
        title,
        description,
        color: "danger",
      });
    },
    [showAlert]
  );

  /**
   * 显示警告通知
   * @param title 标题
   * @param description 描述
   */
  const warning = useCallback(
    (title: string, description: string) => {
      showAlert({
        title,
        description,
        color: "warning",
      });
    },
    [showAlert]
  );

  /**
   * 显示信息通知
   * @param title 标题
   * @param description 描述
   */
  const info = useCallback(
    (title: string, description: string) => {
      showAlert({
        title,
        description,
        color: "primary",
      });
    },
    [showAlert]
  );

  return {
    alertState,
    hideAlert,
    showAlert,
    success,
    error,
    warning,
    info,
  };
};
