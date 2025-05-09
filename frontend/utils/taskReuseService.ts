/**
 * 任务复用服务
 * 提供从历史任务中复用设置到参数页面的功能
 */

import { apiService } from "@/utils/api/apiService";
import { TaskDetail } from "@/types/task";
import * as logger from "@/utils/logger";

// 本地存储键名
const REUSED_TASK_STORAGE_KEY = "reused_task_settings";

/**
 * 从任务详情中提取可复用的设置
 * @param task 任务详情
 * @returns 可复用的设置对象
 */
export const extractReuseSettings = (task: TaskDetail) => {
  try {
    // 提取标签、变量和其他设置
    const { tags = [], variables = {}, settings = {} } = task;

    // 深度复制对象，确保不会有引用问题
    const clonedTags = JSON.parse(JSON.stringify(tags));
    const clonedVariables = JSON.parse(JSON.stringify(variables));
    const clonedSettings = JSON.parse(JSON.stringify(settings));

    // 记录日志，帮助调试
    logger.log("提取的原始标签数据:", clonedTags);
    logger.log("提取的原始变量数据:", clonedVariables);

    // 确保变量和标签之间的关联正确
    const variableTags = clonedTags.filter((tag: any) => tag.isVariable);
    logger.log("变量标签:", variableTags);

    // 检查每个变量是否有对应的标签
    Object.entries(clonedVariables).forEach(([varKey, varData]: [string, any]) => {
      logger.log(`处理变量 ${varKey}:`, varData);

      // 查找对应的标签
      const matchingTag = variableTags.find((tag: any) =>
        (tag.variable_id === varKey) || (varData.tag_id && tag.id === varData.tag_id)
      );

      if (matchingTag) {
        logger.log(`变量 ${varKey} 对应的标签:`, matchingTag);

        // 确保变量数据中有tag_id
        if (!varData.tag_id) {
          logger.log(`为变量 ${varKey} 设置tag_id: ${matchingTag.id}`);
          varData.tag_id = matchingTag.id;
        }

        // 确保标签有variable_id
        if (!matchingTag.variable_id) {
          logger.log(`为标签 ${matchingTag.id} 设置variable_id: ${varKey}`);
          matchingTag.variable_id = varKey;
        }

        // 确保变量有name
        if (!varData.name && matchingTag.name) {
          logger.log(`为变量 ${varKey} 设置name: ${matchingTag.name}`);
          varData.name = matchingTag.name;
        }

        // 确保标签有name
        if (!matchingTag.name && varData.name) {
          logger.log(`为标签 ${matchingTag.id} 设置name: ${varData.name}`);
          matchingTag.name = varData.name;
        }
      } else {
        logger.warn(`变量 ${varKey} 没有对应的标签`);
      }

      // 检查values数组
      if (varData && varData.values) {
        logger.log(`变量 ${varKey} 的values类型:`, typeof varData.values, Array.isArray(varData.values));

        if (Array.isArray(varData.values)) {
          logger.log(`变量 ${varKey} 的values数组长度:`, varData.values.length);

          // 检查第一个值的结构
          if (varData.values.length > 0) {
            logger.log(`变量 ${varKey} 的第一个值:`, varData.values[0]);
          }
        }
      }
    });

    // 返回可复用的设置
    return {
      tags: clonedTags,
      variables: clonedVariables,
      settings: clonedSettings,
      originalTaskId: task.id,
      originalTaskName: task.task_name || `任务 ${task.id.substring(0, 8)}`,
      reuseTimestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("提取任务设置失败:", error);
    throw new Error("提取任务设置失败");
  }
};

/**
 * 保存复用的任务设置到本地存储
 * @param taskSettings 任务设置
 */
export const saveReuseSettings = (taskSettings: any) => {
  try {
    localStorage.setItem(REUSED_TASK_STORAGE_KEY, JSON.stringify(taskSettings));
    logger.log("任务设置已保存到本地存储");
    return true;
  } catch (error) {
    logger.error("保存任务设置失败:", error);
    return false;
  }
};

/**
 * 获取保存的复用任务设置
 * @returns 保存的任务设置，如果没有则返回null
 */
export const getReusedSettings = () => {
  try {
    const savedSettings = localStorage.getItem(REUSED_TASK_STORAGE_KEY);
    if (!savedSettings) {
      return null;
    }

    return JSON.parse(savedSettings);
  } catch (error) {
    logger.error("获取保存的任务设置失败:", error);
    return null;
  }
};

/**
 * 清除保存的复用任务设置
 */
export const clearReusedSettings = () => {
  try {
    localStorage.removeItem(REUSED_TASK_STORAGE_KEY);
    return true;
  } catch (error) {
    logger.error("清除任务设置失败:", error);
    return false;
  }
};

/**
 * 复用任务设置
 * 从数据库获取任务详情，提取设置并保存到本地存储
 * @param taskId 任务ID
 * @returns 操作结果
 */
export const reuseTaskSettings = async (taskId: string) => {
  try {
    logger.log(`开始复用任务设置，任务ID: ${taskId}`);

    // 从API获取任务详情
    const response = await apiService.task.getTaskDetail(taskId);

    if (response.error || !response.data) {
      throw new Error(response.error || "获取任务详情失败");
    }

    // 提取可复用的设置
    const reuseSettings = extractReuseSettings(response.data);

    // 保存到本地存储
    const saveResult = saveReuseSettings(reuseSettings);

    if (!saveResult) {
      throw new Error("保存任务设置失败");
    }

    return {
      success: true,
      message: "任务设置已复用，请前往参数页面查看",
      data: reuseSettings,
    };
  } catch (error) {
    logger.error("复用任务设置失败:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "复用任务设置失败",
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
};
