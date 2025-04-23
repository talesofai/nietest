import { NextRequest, NextResponse } from "next/server";

// API基础URL
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

/**
 * 处理GET请求 - 获取所有用户的任务列表
 */
export async function GET(request: NextRequest) {
  try {
    // 获取原始请求的URL并解析查询参数
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();

    // 构建转发到后端的URL
    const apiUrl = `${API_BASE_URL}/api/v1/tasks${queryString ? `?${queryString}` : ""}`;

    // eslint-disable-next-line no-console
    console.log(`转发请求到: ${apiUrl}`);

    // 获取原始请求的头部
    const headers = new Headers(request.headers);

    // 添加必要的头部
    headers.set("Origin", "http://localhost:3000");
    headers.set("x-platform", "nieta-app/web");

    // 删除一些可能导致问题的头部
    headers.delete("host");

    // 发送请求到后端API
    const response = await fetch(apiUrl, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    // 获取响应数据
    const data = await response.json();

    // eslint-disable-next-line no-console
    console.log("任务列表API响应:", response.status, data);

    // 返回响应

    return NextResponse.json(data, {
      status: response.status,
      statusText: response.statusText,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("任务列表API代理错误:", error);

    // 返回错误响应

    return NextResponse.json(
      {
        code: 500,
        message: "服务器内部错误",
        data: null,
      },
      { status: 500 },
    );
  }
}

/**
 * 处理OPTIONS请求 - 处理预检请求
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Token, X-Platform",
      "Access-Control-Max-Age": "86400",
    },
  });
}
