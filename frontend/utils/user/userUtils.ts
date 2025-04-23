import { getAuthToken, getCurrentUser } from "@/utils/apiClient";

/**
 * 获取当前登录用户名
 * @returns 当前用户名，如果未登录则返回'anonymous_user'
 */
export const getCurrentUsername = async (): Promise<string> => {
  // 首先检查是否有有效的认证令牌
  const token = getAuthToken();

  if (!token) {
    // eslint-disable-next-line no-console
    console.log("未找到有效的认证令牌，使用匿名用户名");

    return "anonymous_user";
  }

  try {
    // 调用API获取当前用户信息
    const userResponse = await getCurrentUser();

    // eslint-disable-next-line no-console
    console.log("用户响应数据:", userResponse);

    // 如果成功获取用户信息
    if (userResponse.data) {
      const userData = userResponse.data;

      // 按优先级尝试使用不同的用户名字段
      if (userData.fullname) {
        return userData.fullname;
      } else if (userData.email) {
        // 如果只有邮箱，可以截取邮箱前缀作为用户名

        return userData.email.split("@")[0];
      } else if (userData._id) {
        // 使用用户ID - 这应该是最稳健的方法

        return userData._id;
      } else if (userData.id) {
        // 后端可能使用id而不是_id

        return userData.id;
      }
    }

    // 如果无法获取用户信息，使用匿名用户名
    // eslint-disable-next-line no-console
    console.log("无法从响应中解析有效的用户标识符");

    return "anonymous_user";
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("获取用户信息失败:", error);

    return "anonymous_user";
  }
};

/**
 * 检查用户是否已登录
 * 使用统一的 token 检测方法
 */
export const checkUserLoggedIn = (): {
  code: string;
  message: string;
} | null => {
  if (typeof window === "undefined") return null; // 在服务器端不检查登录状态

  // 使用统一的 token 获取方法
  const token = getAuthToken();

  // 如果没有找到有效令牌，返回错误
  if (!token) {
    return {
      code: "NOT_LOGGED_IN",
      message: "请先登录后再提交内容",
    };
  }

  return null;
};
