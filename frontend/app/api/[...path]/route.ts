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

export async function OPTIONS(_request: NextRequest) {
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
    // 构建目标URL路径 - 保持和原始请求相同的路径
    const targetPath = `/${pathSegments.join("/")}`;

    // 获取查询参数
    const url = new URL(request.url);
    const queryString = url.search;

    // 构建完整URL
    const apiUrl = `${API_BASE_URL}${targetPath}${queryString}`;

    // eslint-disable-next-line no-console
    console.log(`[API代理] 转发请求到: ${apiUrl}`);

    // 创建头部对象
    const headers = new Headers();

    // 复制原始请求的头信息，但排除特定的头
    const excludeHeaders = ["host", "connection", "content-length", "origin"];

    request.headers.forEach((value, key) => {
      if (!excludeHeaders.includes(key.toLowerCase())) {
        headers.append(key, value);
      }
    });

    // 如果没有内容类型头，添加一个默认的
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    // 创建请求配置
    const requestInit: RequestInit = {
      method,
      headers,
      cache: "no-store",
    };

    // 对于有请求体的方法，添加请求体
    if (["POST", "PUT", "PATCH"].includes(method)) {
      try {
        const contentType = request.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          // JSON数据
          const body = await request.json().catch(() => ({}));

          requestInit.body = JSON.stringify(body);
        } else if (contentType.includes("multipart/form-data")) {
          // 表单数据
          const formData = await request.formData().catch(() => new FormData());

          requestInit.body = formData;
          // 移除content-type头，让浏览器自动设置正确的boundary
          headers.delete("content-type");
        } else if (contentType.includes("application/x-www-form-urlencoded")) {
          // URL编码的表单数据
          const formData = await request.formData().catch(() => new FormData());
          const urlSearchParams = new URLSearchParams();

          formData.forEach((value, key) => {
            urlSearchParams.append(key, value.toString());
          });

          requestInit.body = urlSearchParams.toString();
          headers.set("content-type", "application/x-www-form-urlencoded");
        } else {
          // 其他类型数据，作为文本处理
          const text = await request.text().catch(() => "");

          requestInit.body = text;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[API代理] 处理请求体错误:", err);
        // 如果有错误，继续不带请求体发送请求
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `[API代理] 发送${method}请求到: ${apiUrl}, 头信息:`,
      Object.fromEntries(headers.entries()),
    );

    // 发送请求到后端服务器
    const response = await fetch(apiUrl, requestInit);

    // eslint-disable-next-line no-console
    console.log(`[API代理] 收到响应: ${response.status}`);

    // 读取响应数据
    let responseData;
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      try {
        responseData = await response.json();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[API代理] 解析JSON响应错误:", err);
        responseData = { error: "无法解析JSON响应" };
      }
    } else {
      try {
        const text = await response.text();

        // 尝试解析为JSON
        try {
          responseData = JSON.parse(text);
        } catch (_) {
          // 如果不是JSON，直接返回文本
          responseData = { text };
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[API代理] 读取响应错误:", err);
        responseData = { error: "无法读取响应" };
      }
    }

    // 创建响应头
    const responseHeaders = new Headers();

    // 复制原始响应的头信息
    response.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    // 添加CORS头
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS, PATCH",
    );
    responseHeaders.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Token, X-Platform",
    );

    // 返回响应
    const nextResponse = NextResponse.json(responseData, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });

    return nextResponse;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[API代理] 错误:", error);
    const errorMessage = error instanceof Error ? error.message : "未知错误";

    // eslint-disable-next-line no-console
    console.error("[API代理] 错误细节:", errorMessage);

    return NextResponse.json(
      {
        error: "代理请求失败",
        message: errorMessage,
        targetUrl: `${API_BASE_URL}/${pathSegments.join("/")}`,
        method,
      },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods":
            "GET, POST, PUT, DELETE, OPTIONS, PATCH",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, X-Token, X-Platform",
        },
      },
    );
  }
}
