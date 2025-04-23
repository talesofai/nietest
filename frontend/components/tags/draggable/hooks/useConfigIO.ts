import { validateTags, validateVariableValues } from "../validators";

import { alertService } from "@/utils/alertService";
import { Tag } from "@/types/tag";
import { VariableValue } from "@/types/variable";

/**
 * 全局设置类型
 */
interface GlobalSettings {
  maxThreads: number;
  xToken: string;
}

/**
 * 配置导入导出自定义 Hook
 * 处理配置的下载和上传操作
 */
export const useConfigIO = (
  tags: Tag[],
  variableValues: VariableValue[],
  globalSettings: GlobalSettings,
  setTags: React.Dispatch<React.SetStateAction<Tag[]>>,
  setVariableValues: React.Dispatch<React.SetStateAction<VariableValue[]>>,
  setGlobalSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>,
) => {
  // 处理配置下载
  const handleDownloadConfig = () => {
    try {
      // 创建配置对象
      const config = {
        tags,
        variableValues,
        globalSettings,
        exportDate: new Date().toISOString(),
        version: "1.0",
      };

      // 转换为JSON字符串
      const configJson = JSON.stringify(config, null, 2);

      // 创建 Blob 对象
      const blob = new Blob([configJson], { type: "application/json" });

      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = `tags-config-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();

      // 清理
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);

      // 显示成功提示
      alertService.success("配置已下载", "标签和变量配置已成功下载到本地文件");
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("下载配置失败:", error);
      alertService.error("下载失败", "配置文件下载过程中出现错误");
    }
  };

  // 处理配置上传
  const handleUploadConfig = () => {
    try {
      // 创建一个隐藏的文件输入元素
      const input = document.createElement("input");

      input.type = "file";
      input.accept = "application/json";
      input.style.display = "none";

      // 监听文件选择事件
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];

        if (!file) return;

        const reader = new FileReader();

        reader.onload = (event) => {
          try {
            const content = event.target?.result as string;
            const config = JSON.parse(content);

            // 验证配置文件
            if (
              !config.tags ||
              !Array.isArray(config.tags) ||
              !config.variableValues ||
              !Array.isArray(config.variableValues)
            ) {
              throw new Error("无效的配置文件格式");
            }

            // 应用配置
            setTags(validateTags(config.tags));
            setVariableValues(
              validateVariableValues(
                config.variableValues,
                validateTags(config.tags),
              ),
            );

            // 如果有全局设置，也应用它
            if (config.globalSettings) {
              setGlobalSettings((prev) => ({
                maxThreads: config.globalSettings.maxThreads || prev.maxThreads,
                xToken: config.globalSettings.xToken || prev.xToken,
              }));
            }

            // 显示成功提示
            alertService.success(
              "配置已加载",
              `成功加载了 ${config.tags.length} 个标签和 ${config.variableValues.length} 个变量值`,
            );
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error("解析配置文件失败:", error);
            alertService.error("加载失败", "配置文件格式无效或损坏");
          }
        };

        reader.onerror = () => {
          alertService.error("读取失败", "读取文件时出现错误");
        };

        reader.readAsText(file);

        // 清理输入元素
        document.body.removeChild(input);
      };

      // 添加到文档并触发点击
      document.body.appendChild(input);
      input.click();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("上传配置失败:", error);
      alertService.error("上传失败", "配置文件上传过程中出现错误");
    }
  };

  // 清除所有标签和变量值
  const clearAllTags = () => {
    setTags([]);
    setVariableValues([]);
    alertService.info("已清空", "所有标签和变量值已清空");
  };

  // 创建基础配置
  const createBaseConfig = () => {
    // 创建基础配置标签
    const baseConfig: Tag[] = [
      {
        id: "prompt-" + Date.now(),
        type: "prompt",
        isVariable: false,
        value: "1girl",
        color: "#4B9CD3",
        useGradient: false,
      },
      {
        id: "ratio-" + Date.now(),
        type: "ratio",
        isVariable: false,
        value: "3:5",
        color: "#F15A24",
        useGradient: false,
      },
      {
        id: "batch-" + Date.now(),
        type: "batch",
        isVariable: false,
        value: "1",
        color: "#8CC63F",
        useGradient: false,
      },
      {
        id: "seed-" + Date.now(),
        type: "seed",
        isVariable: false,
        value: "0",
        color: "#662D91",
        useGradient: false,
      },
      {
        id: "polish-" + Date.now(),
        type: "polish",
        isVariable: false,
        value: "false",
        color: "#FFCC00",
        useGradient: false,
      },
    ];

    setTags(baseConfig);
    setVariableValues([]); // 清空变量值

    alertService.success("基础配置已创建", "已创建包含基本标签的配置");
  };

  return {
    handleDownloadConfig,
    handleUploadConfig,
    clearAllTags,
    createBaseConfig,
  };
};
