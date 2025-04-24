"use client";

import React, { useState, useEffect } from "react";
import { Card, CardBody, CardHeader, CardFooter } from "@heroui/card";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { useRouter } from "next/navigation";

import { title } from "@/components/primitives";
import { useAuth } from "@/lib/auth";

/**
 * 登录页面组件
 */
const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const router = useRouter();
  const { login, isLoading, user, error: authError } = useAuth();

  // 如果用户已登录，重定向到首页
  useEffect(() => {
    if (user) {
      // eslint-disable-next-line no-console
      console.log("用户已登录，重定向到首页", user);
      router.push("/");
    }
  }, [user, router]);

  // 处理登录请求
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    setDebugInfo(null);

    if (!email || !password) {
      setLocalError("请输入邮箱和密码");

      return;
    }

    try {
      // eslint-disable-next-line no-console
      console.log(`尝试登录，用户名: ${email}`);
      const success = await login(email, password);

      // 设置调试信息
      setDebugInfo(`登录结果: ${success ? "成功" : "失败"}, 认证错误: ${authError || "无"}`);

      if (success) {
        // eslint-disable-next-line no-console
        // eslint-disable-next-line no-console
        // eslint-disable-next-line no-console
        console.log("登录成功，正在重定向...");
        router.push("/");
      } else if (!authError) {
        // 如果没有来自AuthContext的错误，但登录仍然失败
        setLocalError("登录失败，请检查邮箱和密码");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      setLocalError(`网络错误，请稍后重试: ${errorMessage}`);
      // eslint-disable-next-line no-console
      console.error("登录请求失败:", err);
    }
  };

  // 显示的错误信息，优先显示AuthContext的错误
  const displayError = authError || localError;

  return (
    <section className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] py-8 md:py-10">
      <div className="w-full max-w-md">
        <Card className="w-full">
          <CardHeader className="flex flex-col gap-1 items-center">
            <h1 className={title({ size: "sm" })}>用户登录</h1>
          </CardHeader>
          <CardBody>
            {displayError && (
              <div className="bg-danger-50 text-danger border border-danger-200 rounded-md p-3 mb-4 text-sm">
                {displayError}
              </div>
            )}

            {/* 调试信息 */}
            {debugInfo && process.env.NODE_ENV === "development" && (
              <div className="bg-gray-100 border border-gray-300 rounded-md p-2 mb-4 text-xs">
                <details>
                  <summary className="cursor-pointer font-semibold">调试信息</summary>
                  <pre className="mt-2 whitespace-pre-wrap">{debugInfo}</pre>
                </details>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleLogin}>
              <div>
                <Input
                  fullWidth
                  isRequired
                  autoComplete="email"
                  label="邮箱"
                  placeholder="请输入您的邮箱"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Input
                  fullWidth
                  isRequired
                  autoComplete="current-password"
                  label="密码"
                  placeholder="请输入您的密码"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </form>
          </CardBody>
          <CardFooter className="flex flex-col gap-3">
            <Button
              className="w-full"
              color="primary"
              isLoading={isLoading}
              size="lg"
              type="submit"
              onClick={handleLogin}
            >
              登录
            </Button>
            <div className="text-center text-sm text-gray-500 mt-2">
              没有账号? 请联系管理员创建账号
            </div>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
};

export default LoginPage;
