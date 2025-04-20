"use client";

import React from "react";
import { Link, LinkProps } from "@heroui/link";

/**
 * 客户端 Link 组件
 *
 * 用于在服务器组件中安全使用 HeroUI Link 组件
 */
const ClientLink: React.FC<LinkProps> = (props) => {
    return <Link {...props} />;
};

export default ClientLink;