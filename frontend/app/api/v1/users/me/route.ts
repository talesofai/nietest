/**
 * 获取当前用户信息的API路由
 */
export async function GET(request: Request): Promise<Response> {
    try {
        // 从请求头获取token
        const authHeader = request.headers.get('authorization');
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: '未提供授权令牌' }),
                {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        // 提取Bearer令牌
        const token = authHeader.startsWith('Bearer ')
            ? authHeader.substring(7)
            : authHeader;

        if (!token) {
            return new Response(
                JSON.stringify({ error: '授权令牌格式不正确' }),
                {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        // 设置请求头
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`, // FastAPI使用标准Bearer认证
            'x-platform': 'nieta-app/web'
        };

        // 构建请求发送到实际的后端
        const backendUrl = 'http://localhost:8000/api/v1/users/me';
        console.log(`转发用户信息请求到后端: ${backendUrl}`);

        const response = await fetch(backendUrl, {
            method: 'GET',
            headers
        });

        // 获取响应数据
        const responseText = await response.text();
        let data;

        try {
            data = JSON.parse(responseText);
            console.log("后端用户信息原始响应:", data);
        } catch (e) {
            console.error("解析后端JSON响应失败:", e);
            console.log("原始响应文本:", responseText);
            return new Response(
                JSON.stringify({ error: '解析后端响应失败' , data: responseText }),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        // 如果响应不成功，返回错误
        if (!response.ok) {
            return new Response(
                JSON.stringify({
                    error: data.detail || '获取用户信息失败',
                    status: response.status
                }),
                {
                    status: response.status,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        // 提取实际的用户数据 - 处理可能的嵌套结构
        const userData = data.data ? data.data : data;

        // 返回标准格式的响应
        return new Response(
            JSON.stringify({
                code: 200,
                message: 'success',
                data: {
                    _id: userData.id || userData._id || userData.uuid,
                    email: userData.email,
                    fullname: userData.fullname || userData.username,
                    roles: userData.roles || ['user'],
                    is_active: userData.is_active !== undefined ? userData.is_active : true,
                    created_at: userData.created_at || new Date().toISOString(),
                    updated_at: userData.updated_at || new Date().toISOString()
                }
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    } catch (error) {
        console.error('获取用户信息失败:', error);
        return new Response(
            JSON.stringify({
                code: 500,
                message: '服务器处理请求时出错',
                data: null
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}