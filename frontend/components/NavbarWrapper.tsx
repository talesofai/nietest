"use client";

import React from "react";

import { Navbar } from "@/components/navbar";

/**
 * Navbar包装器组件
 *
 * 这是一个客户端组件，专门用于包装使用了useAuth等客户端特性的Navbar
 */
const NavbarWrapper: React.FC = () => {
  return <Navbar />;
};

export default NavbarWrapper;
