"use client";

import React from "react";
import { Icon } from "@iconify/react";

/**
 * 用户图标组件
 * 使用 Iconify 的 Solar 线性用户图标
 */
const UserIcon: React.FC<{ size?: number }> = ({ size = 16 }) => {
  return <Icon height={size} icon="solar:user-linear" width={size} />;
};

export default UserIcon;
