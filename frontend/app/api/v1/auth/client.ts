import { useRouter } from "next/navigation";
import { useState, useEffect, createContext, useContext } from "react";
import { User } from "@/types/api";
import { loginApi, getCurrentUser } from "@/utils/apiClient";

// 辅助函数 - 本地存储
const getStorageItem = (key: string): string | null => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem(key);
    }
    return null;
};

const setStorageItem = (key: string, value: string): void => {
    if (typeof window !== 'undefined') {
        localStorage.setItem(key, value);
    }
};

const removeStorageItem = (key: string): void => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(key);
    }
};

/**
 * 认证上下文接口
 */
export interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => void;
    checkAuth: () => Promise<boolean>;
}

/**
 * 创建认证上下文
 */
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * 使用认证上下文的钩子
 */
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth 必须在 AuthProvider 内部使用");
    }
    return context;
};

/**
 * 创建认证提供器自定义钩子
 */
export const useAuthProvider = () => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    // 获取用户信息
    const fetchUserInfo = async () => {
        setError(null);
        try {
            console.log("正在获取用户信息...");
            const response = await getCurrentUser();
            console.log("获取用户信息响应:", response);

            if (response.error) {
                setUser(null);
                setError(response.error);
                if (response.status === 401) {
                    // Token 无效，清除本地存储
                    removeStorageItem("access_token");
                    setToken(null);
                }
                return false;
            } else if (response.data) {
                // 尝试从响应中解析用户数据，处理可能的嵌套结构
                let userData: any = response.data;

                // 检查并调整用户数据格式 - 支持多种可能的后端响应格式
                if (userData.code !== undefined && userData.data !== undefined) {
                    userData = userData.data; // 标准响应格式的内层data
                }

                console.log("获取到用户信息:", userData);
                setUser(userData as User);
                return true;
            } else {
                setUser(null);
                setError("获取用户信息失败: 响应中没有数据");
                return false;
            }
        } catch (error) {
            console.error("获取用户信息失败:", error);
            setUser(null);
            setError(`网络错误，无法连接到API服务器: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    };

    // 登录方法
    const login = async (email: string, password: string): Promise<boolean> => {
        setIsLoading(true);
        setError(null);

        try {
            console.log(`尝试登录，用户名: ${email}`);
            const response = await loginApi(email, password);

            console.log("登录响应:", response);

            if (response.error) {
                setIsLoading(false);
                setError(response.error);
                return false;
            }

            // 检查响应数据正确性
            // 处理可能的多层嵌套响应
            console.log('处理登录响应:', response.data);

            // 提取access_token，处理可能的多层嵌套
            let accessToken = null;

            // 尝试不同的响应格式
            if (response.data?.access_token) {
                // 直接在根层级的access_token
                accessToken = response.data.access_token;
            } else if (response.data?.data?.access_token) {
                // 嵌套在data属性中的access_token
                accessToken = response.data.data.access_token;
            } else if (response.data?.data?.data?.access_token) {
                // 多层嵌套的access_token
                accessToken = response.data.data.data.access_token;
            }

            if (accessToken) {
                console.log("登录成功，已获取访问令牌:", accessToken);

                // 存储token到localStorage
                setStorageItem("access_token", accessToken);
                setToken(accessToken);

                // 获取用户信息
                const authSuccess = await fetchUserInfo();
                setIsLoading(false);
                return authSuccess;
            } else {
                console.error("登录响应结构不正确:", response);
                setIsLoading(false);
                setError("登录响应结构不正确，无法获取访问令牌");
                return false;
            }
        } catch (error) {
            console.error("登录失败:", error);
            setIsLoading(false);
            setError(`网络错误，无法连接到API服务器: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    };

    // 退出登录方法
    const logout = () => {
        removeStorageItem("access_token");
        setToken(null);
        setUser(null);
        router.push("/login");
    };

    // 检查认证状态
    const checkAuth = async (): Promise<boolean> => {
        if (!token) return false;
        return await fetchUserInfo();
    };

    // 初始化时检查用户认证状态
    useEffect(() => {
        const initAuth = async () => {
            const storedToken = getStorageItem("access_token");
            if (storedToken) {
                setToken(storedToken);
                await fetchUserInfo();
            }
            setIsLoading(false);
        };

        initAuth();
    }, []);

    return {
        user,
        token,
        isLoading,
        error,
        login,
        logout,
        checkAuth,
    };
};