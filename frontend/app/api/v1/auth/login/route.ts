import { NextRequest, NextResponse } from "next/server";

// API基础URL
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

/**
 * 处理POST请求 - 用户登录
 * 需要application/x-www-form-urlencoded格式的请求体
 * 并返回TokenResponseDTO格式的响应
 */
export async function POST(request: NextRequest) {
  try {
    // 获取请求体
    const formData = await request.formData();

    // 构建转发到后端的URL
    const apiUrl = `${API_BASE_URL}/api/v1/auth/login`;
    console.log(`转发登录请求到: ${apiUrl}`);

    // 创建新的URLSearchParams对象 - 这是FastAPI OAuth2认证需要的格式
    const backendFormData = new URLSearchParams();

    backendFormData.append("username", formData.get("username") as string);
    backendFormData.append("password", formData.get("password") as string);

    // 发送请求到后端API
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "x-platform": "nieta-app/web",
      },
      body: backendFormData.toString(),
    });

    // 检查响应状态
    console.log("\u767b\u5f55API\u54cd\u5e94\u72b6\u6001:", response.status);

    // 如果响应不成功，返回错误
    if (!response.ok) {
      let errorMessage = `\u767b\u5f55\u5931\u8d25: ${response.status} ${response.statusText}`;
      let errorData = null;

      try {
        const errorResponse = await response.json();

        errorMessage = errorResponse.detail || errorMessage;
        errorData = errorResponse;
      } catch (e) {
        console.error("\u65e0\u6cd5\u89e3\u6790\u9519\u8bef\u54cd\u5e94:", e);
      }

      return NextResponse.json(
        {
          code: response.status,
          message: errorMessage,
          data: errorData,
        },
        { status: response.status },
      );
    }

    // 解析成功响应
    const data = await response.json();

    console.log("\u767b\u5f55\u6210\u529f\u54cd\u5e94:", data);

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("\u767b\u5f55API\u4ee3\u7406\u9519\u8bef:", error);

    // 返回错误响应
    return NextResponse.json(
      {
        code: 500,
        message: "\u670d\u52a1\u5668\u5185\u90e8\u9519\u8bef",
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
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Token, X-Platform",
      "Access-Control-Max-Age": "86400",
    },
  });
}
