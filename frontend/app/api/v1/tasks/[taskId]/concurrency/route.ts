import { NextRequest, NextResponse } from 'next/server';

// API基础URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

/**
 * 处理POST请求 - 更新任务并发数
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { taskId: string } }
) {
    try {
        const taskId = params.taskId;

        // 获取URL查询参数中的并发数
        const { searchParams } = new URL(request.url);
        const concurrency = searchParams.get('concurrency');

        if (!concurrency) {
            return NextResponse.json(
                {
                    code: 400,
                    message: '缺少并发数参数',
                    data: null,
                },
                { status: 400 }
            );
        }

        // 验证并发数范围（1-50）
        const concurrencyValue = parseInt(concurrency, 10);
        if (isNaN(concurrencyValue) || concurrencyValue < 1 || concurrencyValue > 50) {
            return NextResponse.json(
                {
                    code: 400,
                    message: '并发数必须是1至50之间的整数',
                    data: null,
                },
                { status: 400 }
            );
        }

        // 构建转发到后端的URL
        const apiUrl = `${API_BASE_URL}/api/v1/tasks/${taskId}/concurrency?concurrency=${concurrencyValue}`;

        // 获取原始请求的头部
        const headers = new Headers(request.headers);

        // 添加必要的头部
        // headers.set('Origin', 'http://localhost:3000'); // 移除Origin头部设置
        headers.set('x-platform', 'nieta-app/web');
        headers.set('Content-Type', 'application/json');
        headers.set('Accept', 'application/json');

        // 删除一些可能导致问题的头部
        headers.delete('host');

        // 发送请求到后端API
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
        });

        // 获取响应数据
        const data = await response.json();

        // 返回响应
        return NextResponse.json(data, {
            status: response.status,
            statusText: response.statusText,
        });
    } catch (error) {
        console.error('更新任务并发数API代理错误:', error);

        // 返回错误响应
        return NextResponse.json(
            {
                code: 500,
                message: '服务器内部错误',
                data: null,
            },
            { status: 500 }
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
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Token, X-Platform',
            'Access-Control-Max-Age': '86400',
        },
    });
}