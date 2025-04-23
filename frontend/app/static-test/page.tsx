"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader, Button } from "@heroui/react";

import { title, subtitle } from "@/components/primitives";
import { getApiBaseUrl } from "@/utils/apiClient";

export default function StaticTestPage() {
  const [apiUrl, setApiUrl] = useState<string>("");
  const [apiResponse, setApiResponse] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 获取API基础URL
    setApiUrl(getApiBaseUrl());
  }, []);

  const testApiConnection = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 调用后端健康检查API
      const response = await fetch(`${apiUrl}/health`);
      const data = await response.json();
      
      setApiResponse(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("API连接测试失败:", err);
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex flex-col items-center justify-center gap-8 py-8 md:py-10">
      <div className="inline-block max-w-2xl text-center justify-center">
        <h1 className={title()}>静态页面测试</h1>
        <p className={subtitle({ class: "mt-4" })}>
          测试静态页面直接调用后端API
        </p>
      </div>

      <Card className="w-full max-w-2xl">
        <CardHeader className="flex flex-col gap-1">
          <h2 className="text-xl font-medium">API连接测试</h2>
          <p className="text-sm text-gray-500">
            点击按钮测试与后端API的连接
          </p>
        </CardHeader>
        <CardBody className="flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">API地址:</span>
            <span className="text-sm">{apiUrl}</span>
          </div>

          <Button 
            color="primary" 
            onClick={testApiConnection}
            isLoading={loading}
          >
            测试API连接
          </Button>

          {error && (
            <div className="bg-danger-50 text-danger border border-danger-200 rounded-md p-3 text-sm">
              {error}
            </div>
          )}

          {apiResponse && (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
              <h3 className="text-md font-medium mb-2">API响应:</h3>
              <pre className="text-xs overflow-auto">{apiResponse}</pre>
            </div>
          )}
        </CardBody>
      </Card>
    </section>
  );
}
