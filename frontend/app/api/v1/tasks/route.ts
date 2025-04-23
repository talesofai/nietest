import { NextRequest, NextResponse } from "next/server";

import { getApiBaseUrl } from "@/utils/apiClient";

// API基础URL，从集中位置获取
const API_BASE_URL = getApiBaseUrl();

/**
 * 处理GET请求 - 获取任务列表
 */
export async function GET(request: NextRequest) {
  try {
    // 解析URL参数以便转发
    const { searchParams } = new URL(request.url);

    // 构建转发到后端的URL，包含所有查询参数，确保有尾部斜杠
    const apiUrl = `${API_BASE_URL}/api/v1/tasks/?${searchParams.toString()}`;

    // eslint-disable-next-line no-console
    console.log(`转发任务列表请求到: ${apiUrl}`);

    // 获取原始请求的头部
    const headers = new Headers(request.headers);

    // 添加必要的头部
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json");

    // 删除一些可能导致问题的头部
    headers.delete("host");

    // 保留Authorization头部，确保认证信息被传递
    // eslint-disable-next-line no-console
    console.log(
      "Authorization头部:",
      headers.get("Authorization") ? "存在" : "不存在",
    );
    // eslint-disable-next-line no-console
    console.log("转发请求方法:", "GET");
    // eslint-disable-next-line no-console
    console.log("转发请求头部:", {
      "Content-Type": headers.get("Content-Type"),
      Accept: headers.get("Accept"),
      Authorization: headers.has("Authorization")
        ? `${headers.get("Authorization")?.substring(0, 15)}...`
        : "无",
    });

    // 发送请求到后端API
    const response = await fetch(apiUrl, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    // 获取响应数据和状态
    // eslint-disable-next-line no-console
    console.log("后端响应状态:", response.status);
    // eslint-disable-next-line no-console
    console.log("后端响应状态文本:", response.statusText);

    // 获取响应数据
    const responseText = await response.text();

    // eslint-disable-next-line no-console
    console.log(
      "后端响应内容:",
      responseText.substring(0, 100) + (responseText.length > 100 ? "..." : ""),
    );

    let data;

    try {
      // 尝试解析JSON
      data = JSON.parse(responseText);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("解析响应JSON失败:", e);

      // 如果无法解析为JSON，则以文本形式返回

      return NextResponse.json(
        {
          code: response.status,
          message: "无法解析后端响应为JSON",
          data: responseText,
        },
        { status: 500 },
      );
    }

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
        message: `服务器内部错误: ${error instanceof Error ? error.message : String(error)}`,
        data: null,
      },
      { status: 500 },
    );
  }
}

/**
 * 处理POST请求 - 创建任务
 */
export async function POST(request: NextRequest) {
  try {
    // 解析请求数据
    const requestData = await request.json();

    // 构建转发到后端的URL，确保有尾部斜杠
    const apiUrl = `${API_BASE_URL}/api/v1/tasks/`;

    // eslint-disable-next-line no-console
    console.log(`转发创建任务请求到: ${apiUrl}`);

    // 获取原始请求的头部
    const headers = new Headers(request.headers);

    // 添加必要的头部
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json");

    // 删除一些可能导致问题的头部
    headers.delete("host");

    // 发送请求到后端API
    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(requestData),
    });

    // 获取响应数据
    const data = await response.json();

    // 返回响应

    return NextResponse.json(data, {
      status: response.status,
      statusText: response.statusText,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("创建任务API代理错误:", error);

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
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Token, X-Platform",
      "Access-Control-Max-Age": "86400",
    },
  });
}
