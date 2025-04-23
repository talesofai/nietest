import { NextRequest, NextResponse } from "next/server";

import { getApiBaseUrl } from "@/utils/apiClient";

// API基础URL，从集中位置获取
const API_BASE_URL = getApiBaseUrl();

/**
 * 处理所有请求方法
 */
export async function GET(request: NextRequest, context: any) {
  return await proxyRequest(request, context.params.path, "GET");
}

export async function POST(request: NextRequest, context: any) {
  return await proxyRequest(request, context.params.path, "POST");
}

export async function PUT(request: NextRequest, context: any) {
  return await proxyRequest(request, context.params.path, "PUT");
}

export async function DELETE(request: NextRequest, context: any) {
  return await proxyRequest(request, context.params.path, "DELETE");
}

export async function PATCH(request: NextRequest, context: any) {
  return await proxyRequest(request, context.params.path, "PATCH");
}

export async function OPTIONS(_request: NextRequest, _context: any) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Token, X-Platform",
      "Access-Control-Max-Age": "86400",
    },
  });
}

/**
 * 代理请求函数
 */
async function proxyRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string,
) {
  try {
    // 构建目标URL路径
    const targetPath = `/${pathSegments.join("/")}`;

    // 获取查询参数
    const url = new URL(request.url);
    const queryString = url.search;

    // 构建完整URL - 确保路径格式正确
    const apiUrl = `${API_BASE_URL}/api/v1/${targetPath}${queryString}`;

    console.log(`代理请求到: ${apiUrl}`);

    // 获取请求头
    const headers = new Headers();

    request.headers.forEach((value, key) => {
      // 跳过host头和origin头，因为它们会导致问题
      if (
        !["host", "origin", "connection", "content-length"].includes(
          key.toLowerCase(),
        )
      ) {
        headers.set(key, value);
      }
    });

    // 设置内容类型
    if (!headers.has("content-type")) {
      headers.set("Content-Type", "application/json");
    }

    // 创建请求配置
    const requestInit: RequestInit = {
      method,
      headers,
      cache: "no-store",
    };

    // 对于有请求体的方法，添加请求体
    if (["POST", "PUT", "PATCH"].includes(method)) {
      const contentType = request.headers.get("content-type");

      if (contentType && contentType.includes("application/json")) {
        const body = await request.json();

        requestInit.body = JSON.stringify(body);
      } else {
        const body = await request.text();

        requestInit.body = body;
      }
    }

    // 发送请求到API服务器
    const response = await fetch(apiUrl, requestInit);

    // 读取响应
    const responseData = await response.json().catch(() => ({}));

    // 创建响应头
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    // 设置CORS头
    responseHeaders.set("Access-Control-Allow-Origin", "*");

    // 返回响应
    return NextResponse.json(responseData, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("API代理错误:", error);

    return NextResponse.json({ error: "代理请求失败" }, { status: 500 });
  }
}