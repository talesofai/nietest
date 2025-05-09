import { useEffect, useState } from "react";
import { Tag } from "@/types/tag";
import { VariableValue } from "@/types/variable";
import { getReusedSettings, clearReusedSettings } from "@/utils/taskReuseService";
import { alertService } from "@/utils/alertService";
import * as logger from "@/utils/logger";

/**
 * 全局设置类型
 */
interface GlobalSettings {
  maxThreads: number;
  xToken: string;
}

/**
 * 任务复用自定义Hook
 * 检查是否有复用的任务设置，并应用到当前标签和变量
 */
export const useTaskReuse = (
  setTags: React.Dispatch<React.SetStateAction<Tag[]>>,
  setVariableValues: React.Dispatch<React.SetStateAction<VariableValue[]>>,
  setGlobalSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>
) => {
  // 是否有复用的任务设置
  const [hasReusedTask, setHasReusedTask] = useState(false);
  // 复用的任务信息
  const [reusedTaskInfo, setReusedTaskInfo] = useState<{
    taskId: string;
    taskName: string;
    timestamp: string;
  } | null>(null);

  // 在组件挂载时检查是否有复用的任务设置
  useEffect(() => {
    const checkReusedTask = () => {
      try {
        // 获取复用的任务设置
        const reusedSettings = getReusedSettings();

        if (!reusedSettings) {
          return;
        }

        logger.log("检测到复用的任务设置:", reusedSettings);

        // 提取任务信息
        const taskInfo = {
          taskId: reusedSettings.originalTaskId || "",
          taskName: reusedSettings.originalTaskName || "未知任务",
          timestamp: reusedSettings.reuseTimestamp || new Date().toISOString(),
        };

        // 更新状态
        setHasReusedTask(true);
        setReusedTaskInfo(taskInfo);

        // 显示通知
        alertService.info({
          title: "检测到复用的任务设置",
          description: `已加载任务"${taskInfo.taskName}"的设置`,
        });
      } catch (error) {
        logger.error("检查复用任务设置失败:", error);
      }
    };

    checkReusedTask();
  }, []);

  /**
   * 应用复用的任务设置
   * @returns 是否成功应用
   */
  const applyReusedSettings = (): boolean => {
    try {
      // 获取复用的任务设置
      const reusedSettings = getReusedSettings();

      if (!reusedSettings) {
        alertService.error({
          title: "应用失败",
          description: "没有可用的复用任务设置",
        });
        return false;
      }

      // 提取标签和变量
      const { tags = [], variables = {} } = reusedSettings;

      logger.log("开始应用复用设置，变量数据:", variables);
      logger.log("标签数据:", tags);

      // 打印变量标签的映射关系，帮助调试
      const variableTags = tags.filter((tag: Tag) => tag.isVariable);
      logger.log("变量标签:", variableTags);

      // 检查每个变量是否有对应的标签
      Object.keys(variables).forEach((varKey) => {
        const hasTag = variableTags.some((tag: Tag) => tag.variable_id === varKey);
        logger.log(`变量 ${varKey} ${hasTag ? '有' : '没有'}对应的标签`);
      });

      // 转换变量为变量值数组
      const variableValues: VariableValue[] = [];

      // 处理变量
      Object.entries(variables).forEach(([variableKey, variableData]: [string, any]) => {
        // 检查是否是v0-v6格式的变量
        if (variableKey.match(/^v[0-6]$/) && variableData) {
          logger.log(`处理变量 ${variableKey}:`, variableData);

          // 根据MongoDB数据结构，直接使用tag_id查找对应的标签
          const tagId = variableData.tag_id;
          const matchingTag = tagId ? tags.find((tag: Tag) => tag.id === tagId) : null;

          // 如果没有找到标签，尝试通过variable_id查找
          const fallbackTag = !matchingTag ?
            tags.find((tag: Tag) => tag.isVariable && tag.variable_id === variableKey) : null;

          // 使用找到的标签或回退标签
          const finalTag = matchingTag || fallbackTag;
          const finalTagId = finalTag?.id || tagId;

          if (finalTag || tagId) {
            const actualTagId = finalTagId || (finalTag ? finalTag.id : null);

            if (!actualTagId) {
              logger.warn(`变量 ${variableKey} 没有有效的标签ID`);
              return;
            }

            logger.log(`处理变量 ${variableKey}, 标签ID: ${actualTagId}, 标签类型: ${finalTag?.type || '未知'}`);

            // 检查变量是否有values数组
            if (variableData.values && Array.isArray(variableData.values)) {
              // 添加变量值
              variableData.values.forEach((valueItem: any, index: number) => {
                try {
                  if (!valueItem) {
                    logger.warn(`跳过空的变量值`);
                    return;
                  }

                  logger.log(`处理变量值 ${index}:`, valueItem);

                  // 创建新的变量值对象
                  const newVariableValue: VariableValue = {
                    // 使用原始ID或生成新ID
                    variable_id: valueItem.id || `${actualTagId}_${Date.now()}_${index}`,
                    tag_id: actualTagId,
                    value: valueItem.value || '',
                  };

                  // 复制其他属性
                  if (valueItem.weight !== undefined) newVariableValue.weight = valueItem.weight;
                  if (valueItem.uuid) newVariableValue.uuid = valueItem.uuid;
                  if (valueItem.header_img) newVariableValue.header_img = valueItem.header_img;
                  if (valueItem.type) newVariableValue.type = valueItem.type;
                  if (valueItem.color) newVariableValue.color = valueItem.color;
                  if (valueItem.useGradient !== undefined) newVariableValue.useGradient = valueItem.useGradient;
                  if (valueItem.heat_score !== undefined) newVariableValue.heat_score = valueItem.heat_score;

                  // 对于特定类型的标签，确保有默认值
                  if (finalTag && finalTag.type === 'polish' && newVariableValue.value === '') {
                    newVariableValue.value = 'false';
                  }

                  logger.log(`添加变量值:`, newVariableValue);
                  variableValues.push(newVariableValue);
                } catch (err) {
                  logger.error(`处理变量值时出错:`, err);
                }
              });
            } else {
              logger.warn(`变量 ${variableKey} 没有有效的values数组`);

              // 为没有values的变量创建一个默认值
              if (finalTag) {
                const defaultValue = getDefaultValueForType(finalTag.type);
                const newVariableValue: VariableValue = {
                  variable_id: `${actualTagId}_${Date.now()}_default`,
                  tag_id: actualTagId,
                  value: defaultValue,
                };

                logger.log(`为变量 ${variableKey} 添加默认值:`, newVariableValue);
                variableValues.push(newVariableValue);
              }
            }
          } else {
            logger.warn(`未找到变量 ${variableKey} 对应的标签`);

            // 尝试创建新标签
            if (variableData.name) {
              logger.log(`尝试为变量 ${variableKey} 创建新标签，名称: ${variableData.name}`);

              // 根据变量名称推断类型
              let tagType = 'prompt'; // 默认类型
              const name = variableData.name.toLowerCase();
              if (name.includes('比例')) tagType = 'ratio';
              else if (name.includes('润色')) tagType = 'polish';
              else if (name.includes('角色')) tagType = 'character';
              else if (name.includes('批次') || name.includes('batch')) tagType = 'batch';
              else if (name.includes('种子') || name.includes('seed')) tagType = 'seed';

              // 创建新标签
              const newTagId = `${tagType}-${Date.now()}`;
              const newTag: Tag = {
                id: newTagId,
                type: tagType as any,
                isVariable: true,
                value: '',
                color: getColorForType(tagType),
                name: variableData.name,
                variable_id: variableKey
              };

              // 添加到标签列表
              tags.push(newTag);
              logger.log(`为变量 ${variableKey} 创建了新标签:`, newTag);

              // 处理变量值
              if (variableData.values && Array.isArray(variableData.values)) {
                variableData.values.forEach((valueItem: any, index: number) => {
                  if (!valueItem) return;

                  const newVariableValue: VariableValue = {
                    variable_id: valueItem.id || `${newTagId}_${Date.now()}_${index}`,
                    tag_id: newTagId,
                    value: valueItem.value || '',
                  };

                  // 复制其他属性
                  if (valueItem.weight !== undefined) newVariableValue.weight = valueItem.weight;
                  if (valueItem.uuid) newVariableValue.uuid = valueItem.uuid;
                  if (valueItem.header_img) newVariableValue.header_img = valueItem.header_img;

                  logger.log(`为新标签添加变量值:`, newVariableValue);
                  variableValues.push(newVariableValue);
                });
              }
            }
          }
        }
      });

      // 辅助函数：根据标签类型获取颜色
      function getColorForType(type: string): string {
        switch (type) {
          case 'ratio': return '#64748b';
          case 'polish': return '#8b5cf6';
          case 'character': return '#3b82f6';
          case 'batch': return '#10b981';
          case 'seed': return '#f59e0b';
          default: return '#6b7280';
        }
      }

      // 辅助函数：根据标签类型获取默认值
      function getDefaultValueForType(type: string): string {
        switch (type) {
          case 'polish': return 'false';
          case 'ratio': return '1:1';
          case 'batch': return '1';
          case 'seed': return '';
          default: return '';
        }
      }

      // 确保变量值与标签正确关联
      const validVariableValues = variableValues.filter((value) => {
        // 检查是否有对应的标签
        const hasTag = tags.some((tag) => tag.id === value.tag_id);
        if (!hasTag) {
          logger.warn(`变量值 ${value.variable_id} 没有对应的标签，将被过滤掉`);
        }
        return hasTag;
      });

      logger.log("最终变量值数组:", validVariableValues);

      // 如果没有有效的变量值，尝试创建默认值
      if (validVariableValues.length === 0 && variableTags.length > 0) {
        logger.warn("没有有效的变量值，将创建默认值");

        variableTags.forEach((tag: Tag) => {
          if (tag.variable_id) {
            const defaultValue = getDefaultValueForType(tag.type);
            const newVariableValue: VariableValue = {
              variable_id: `${tag.id}_${Date.now()}_default_${Math.random().toString(36).substring(2, 5)}`,
              tag_id: tag.id,
              value: defaultValue,
            };

            logger.log(`为标签 ${tag.id} 创建默认变量值:`, newVariableValue);
            validVariableValues.push(newVariableValue);
          }
        });
      }

      // 确保标签的variable_id属性正确设置
      const processedTags = tags.map((tag: Tag) => {
        // 如果是变量标签但没有variable_id，尝试找到匹配的变量并设置
        if (tag.isVariable && !tag.variable_id) {
          // 查找匹配的变量
          const matchingVarKey = Object.keys(variables).find((varKey) => {
            const varData = variables[varKey];
            return varData && varData.tag_id === tag.id;
          });

          if (matchingVarKey) {
            logger.log(`为标签 ${tag.id} 设置variable_id: ${matchingVarKey}`);
            return { ...tag, variable_id: matchingVarKey };
          }
        }

        // 确保标签的name属性被设置
        if (tag.isVariable && !tag.name) {
          // 查找匹配的变量
          const matchingVarKey = Object.keys(variables).find((varKey) => {
            const varData = variables[varKey];
            return varData && (varData.tag_id === tag.id || tag.variable_id === varKey);
          });

          if (matchingVarKey && variables[matchingVarKey].name) {
            logger.log(`为标签 ${tag.id} 设置name: ${variables[matchingVarKey].name}`);
            return { ...tag, name: variables[matchingVarKey].name };
          }
        }

        return tag;
      });

      logger.log("处理后的标签:", processedTags);

      // 应用设置
      setTags(processedTags);
      setVariableValues(validVariableValues);

      // 如果有全局设置，也应用它
      if (reusedSettings.settings && typeof reusedSettings.settings === "object") {
        setGlobalSettings((prev) => ({
          maxThreads: reusedSettings.settings.maxThreads || prev.maxThreads,
          xToken: reusedSettings.settings.xToken || prev.xToken,
        }));
      }

      // 显示成功通知
      alertService.success({
        title: "应用成功",
        description: `已应用任务"${reusedSettings.originalTaskName}"的设置`,
      });

      // 清除复用的任务设置
      clearReusedSettings();
      setHasReusedTask(false);
      setReusedTaskInfo(null);

      return true;
    } catch (error) {
      logger.error("应用复用任务设置失败:", error);

      alertService.error({
        title: "应用失败",
        description: error instanceof Error ? error.message : "应用任务设置时发生错误",
      });

      return false;
    }
  };

  /**
   * 忽略复用的任务设置
   */
  const ignoreReusedSettings = (): void => {
    clearReusedSettings();
    setHasReusedTask(false);
    setReusedTaskInfo(null);

    alertService.info({
      title: "已忽略",
      description: "已忽略复用的任务设置",
    });
  };

  return {
    hasReusedTask,
    reusedTaskInfo,
    applyReusedSettings,
    ignoreReusedSettings,
  };
};
