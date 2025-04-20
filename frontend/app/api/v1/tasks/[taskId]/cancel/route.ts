import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/utils/apiClient';

// API基础URL
const API_BASE_URL = getApiBaseUrl();

/**
 * 处理POST请求 - 取消任务
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { taskId: string } }
) {
    try {
        const taskId = params.taskId;

        // 构建转发到后端的URL，确保有尾部斜杠
        const apiUrl = `${API_BASE_URL}/api/v1/tasks/${taskId}/cancel/`;
        console.log(`转发取消任务请求到: ${apiUrl}`);

        // 获取原始请求的头部
        const headers = new Headers(request.headers);

        // 添加必要的头部
        headers.set('Origin', 'http://localhost:3000');
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
        console.error('取消任务API代理错误:', error);

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