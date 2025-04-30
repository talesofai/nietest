import { Tag } from "@/types/tag";
import { VariableValue } from "@/types/variable";
import { alertService } from "@/utils/alertService";
import { apiService } from "@/utils/api/apiService";
import { getCurrentUsername, checkUserLoggedIn } from "@/utils/user/userUtils";

/**
 * 显示通知消息
 * @param options 通知选项
 */
const showAlert = (options: { title: string; description: string; variant?: string }) => {
  // 直接使用alertService
  alertService.show(options);
};

/**
 * 检查标签是否存在
 * @param tags 标签数组
 * @returns 如果有错误返回错误对象，否则返回null
 */
export const checkTagsExist = (tags: Tag[]): { message: string } | null => {
  if (tags.length === 0) {
    return {
      message: "请至少添加一个标签",
    };
  }

  return null;
};

/**
 * 检查变量标签数量是否超过限制 (最多6个变量标签)
 */
export const checkVariableTagsCount = (tags: Tag[]): { code: string; message: string } | null => {
  const variableTags = tags.filter((tag) => tag.isVariable);

  if (variableTags.length > 6) {
    return {
      code: "TOO_MANY_VARIABLE_TAGS",
      message: `变量标签数量不能超过6个，当前有 ${variableTags.length} 个`,
    };
  }

  return null;
};

/**
 * 检查单个变量的值数量
 * @param variable 变量配置
 * @param tagName 标签名称
 * @param tagId 标签ID
 * @returns 如果有错误返回错误对象，否则返回null
 */
const checkSingleVariableValues = (
  variable: any,
  tagName: string | undefined,
  tagId: string
): { code: string; message: string } | null => {
  // 检查变量值数量
  if (!variable.values || variable.values.length === 0) {
    return {
      code: "MISSING_VARIABLE_VALUES",
      message: `变量 "${variable.name || tagName || `ID:${tagId}`}" 需要至少一个值`,
    };
  }

  if (variable.values.length > 100) {
    return {
      code: "TOO_MANY_VARIABLE_VALUES",
      message: `变量 "${variable.name || tagName || `ID:${tagId}`}" 的值不能超过100个`,
    };
  }

  return null;
};

/**
 * 查找变量标签对应的变量配置
 * @param tag 标签
 * @param variables 变量配置对象
 * @returns 找到的变量配置和错误信息
 */
const findVariableConfig = (
  tag: Tag,
  variables: any
): { found: boolean; variable: any; error: { code: string; message: string } | null } => {
  // 遍历v0-v6变量槽
  for (const key of ["v0", "v1", "v2", "v3", "v4", "v5", "v6"]) {
    const variable = variables[key];

    if (variable && variable.tag_id === tag.id) {
      // 检查变量值数量
      const error = checkSingleVariableValues(variable, tag.name, tag.id);

      return { found: true, variable, error };
    }
  }

  // 未找到对应的变量配置
  return {
    found: false,
    variable: null,
    error: {
      code: "VARIABLE_CONFIG_MISSING",
      message: `变量 "${tag.name || `ID:${tag.id}`}" 缺少对应的变量配置`,
    },
  };
};

/**
 * 检查变量值的数量，确保每个变量标签都有足够的值
 * @param variables 变量配置对象
 * @param tags 标签数组
 * @returns 如果有错误返回错误对象，否则返回null
 */
export const checkVariableValuesCount = (
  variables: any,
  tags: Tag[]
): { code: string; message: string } | null => {
  // 找出所有变量标签
  const variableTags = tags.filter((tag) => tag.isVariable);

  if (variableTags.length === 0) {
    return null; // 没有变量标签，验证通过
  }

  // 检查每个变量标签
  for (const tag of variableTags) {
    const { found, error } = findVariableConfig(tag, variables);

    if (!found || error) {
      return error;
    }
  }

  return null;
};

/**
 * 检查标签是否存在禁止的组合
 * @param tags 标签数组
 * @returns 如果有错误返回错误对象，否则返回null
 */
export const checkForbiddenTagCombinations = (
  tags: Tag[]
): { code: string; message: string } | null => {
  // 示例：检查标签组合。在实际应用中，可能需要根据具体业务逻辑进行定制
  const tagNames = tags.map((tag) => (tag.name || "").toLowerCase());

  // 示例：不允许同时使用"废弃"和"推荐"标签
  if (tagNames.includes("废弃") && tagNames.includes("推荐")) {
    return {
      code: "FORBIDDEN_TAG_COMBINATION",
      message: '不能同时使用"废弃"和"推荐"标签',
    };
  }

  return null;
};

/**
 * 将变量值数组转换为变量槽格式
 * @param variableValues 变量值数组
 * @param tags 标签数组
 * @returns 按变量槽格式组织的对象
 */
const convertToVariableSlots = (
  variableValues: VariableValue[],
  tags: Tag[]
): Record<string, any> => {
  const result: Record<string, any> = {};

  // 获取所有变量标签
  const variableTags = tags.filter((tag) => tag.isVariable);

  // 为每个变量标签创建一个变量槽
  variableTags.forEach((tag, index) => {
    if (index >= 7) return; // 最多支持7个变量槽 (v0-v6)

    const slotKey = `v${index}`;

    // 查找与当前标签相关的所有变量值
    const values = variableValues.filter((value) => value.tag_id === tag.id);

    if (values.length > 0) {
      result[slotKey] = {
        tag_id: tag.id,
        name: tag.name || `变量${index + 1}`,
        values: values,
      };
    }
  });

  return result;
};

/**
 * 执行所有验证规则
 * @param tags 标签数组
 * @param variableValues 变量值数组
 * @returns 如果有错误返回错误对象，否则返回null
 */
export const validateSubmission = (
  tags: Tag[],
  variableValues: VariableValue[]
): { code: string; message: string } | null => {
  // 检查用户是否已登录
  const loginError = checkUserLoggedIn();

  if (loginError) return loginError;

  // 检查变量标签数量
  const variableTagsError = checkVariableTagsCount(tags);

  if (variableTagsError) return variableTagsError;

  // 将变量值数组转换为变量槽格式
  const variableSlots = convertToVariableSlots(variableValues, tags);

  // 检查变量值的数量
  const variableValuesError = checkVariableValuesCount(variableSlots, tags);

  if (variableValuesError) return variableValuesError;

  // 检查标签组合
  const tagCombinationError = checkForbiddenTagCombinations(tags);

  if (tagCombinationError) return tagCombinationError;

  // 所有验证通过

  return null;
};

/**
 * 提交前进行验证，如果验证失败会显示错误提示
 * @param tags 标签数组
 * @param variableValues 变量值数组
 * @returns 如果验证通过返回true，否则返回false
 */
export const validateBeforeSubmit = (tags: Tag[], variableValues: VariableValue[]): boolean => {
  // 检查标签是否存在
  const tagsError = checkTagsExist(tags);

  if (tagsError) {
    showAlert({
      title: "提交失败",
      description: tagsError.message,
      variant: "destructive",
    });

    return false;
  }

  // 执行其他验证
  const validationError = validateSubmission(tags, variableValues);

  if (validationError) {
    showAlert({
      title: "提交失败",
      description: validationError.message,
      variant: "destructive",
    });

    return false;
  }

  return true;
};

/**
 * 提交数据的类型
 */
interface SubmitData {
  username: string;
  task_name: string; // 新增任务名称字段
  tags: Array<Tag & { values?: string[] }>;
  variables: Record<
    string,
    {
      tag_id: string;
      name: string;
      values: Array<{
        id: string;
        value: string;
        weight?: number;
        uuid?: string;
        header_img?: string;
      }>;
    }
  >;
  settings: {
    maxThreads: number;
    xToken: string;
  };
  createdAt: string;
}

/**
 * 提交数据的响应类型
 */
interface SubmitResponse {
  success: boolean;
  message: string;
  data?: Record<string, any>;
  error?: string;
  timestamp?: string;
}

/**
 * 获取用户名
 * @returns 用户名或默认匿名用户名
 */
const getUsernameForSubmit = async (): Promise<string> => {
  try {
    return await getCurrentUsername();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("获取用户名失败:", error);

    return "anonymous_user"; // 默认匿名用户名
  }
};

/**
 * 创建变量槽数据
 * @param variableTags 变量标签数组
 * @param variableValues 变量值数组
 * @returns 变量槽数据
 */
const createVariableSlots = (
  variableTags: Tag[],
  variableValues: VariableValue[]
): Record<string, any> => {
  // 创建变量槽格式数据 (v0-v5)，确保所有槽位都存在
  const variables: Record<string, any> = {
    v0: { name: "", values: [] },
    v1: { name: "", values: [] },
    v2: { name: "", values: [] },
    v3: { name: "", values: [] },
    v4: { name: "", values: [] },
    v5: { name: "", values: [] },
  };

  // 为每个变量标签创建对应的变量槽
  variableTags.forEach((tag, index) => {
    if (index >= 6) return; // 最多支持6个变量槽 (v0-v5)

    const slotKey = `v${index}`;
    // 查找与当前标签相关的所有变量值
    const tagValues = variableValues.filter((value) => value.tag_id === tag.id);

    if (tagValues.length > 0) {
      // 创建完整的变量值对象，保留所有原始属性
      const values = tagValues.map((value) => {
        // 如果标签类型是lumina，在变量值中也将其转换为element
        const tagType = tag.type === "lumina" ? "element" : tag.type;

        // 如果是lumina类型，将其转换为element类型，但只保留指定的字段
        if (tag.type === "lumina") {
          // 检查必要字段是否存在
          if (!value.uuid || !value.value || !value.header_img) {
            console.error("Lumina变量值缺少必要字段:", value);
            // 使用默认值创建一个完整的Lumina变量值
            return {
              id: value.variable_id || Date.now().toString(),
              value: "lumina1",
              type: "element",
              color: "#cccccc",
              useGradient: false,
              uuid: "b5edccfe-46a2-4a14-a8ff-f4d430343805",
              header_img: "https://oss.talesofai.cn/picture_s/1y7f53e6itfn_0.jpeg",
              heat_score: 50,
              weight: 1,
            };
          }

          // 只保留指定的字段
          return {
            id: value.variable_id,
            value: value.value || "lumina1",
            type: tagType,
            color: value.color || "#cccccc",
            useGradient: value.useGradient || false,
            uuid: value.uuid || "b5edccfe-46a2-4a14-a8ff-f4d430343805",
            header_img: value.header_img || "https://oss.talesofai.cn/picture_s/1y7f53e6itfn_0.jpeg",
            heat_score: value.heat_score || 50,
            weight: value.weight || 1,
          };
        }

        // 其他类型的变量值处理
        return {
          id: value.variable_id,
          value: value.value,
          type: tagType, // 添加类型字段，确保在后端处理时使用正确的类型
          // 保留权重和其他可能存在的属性
          ...(value.weight !== undefined ? { weight: value.weight } : {}),
          ...(value.uuid ? { uuid: value.uuid } : {}),
          ...(value.header_img ? { header_img: value.header_img } : {}),
        };
      });

      variables[slotKey] = {
        tag_id: tag.id,
        name: tag.name || `变量${index + 1}`,
        values: values,
      };
    }
  });

  return variables;
};

/**
 * 创建标签数据
 * @param tags 标签数组
 * @param variableValues 变量值数组
 * @returns 标签数据
 */
const createTagData = (
  tags: Tag[],
  variableValues: VariableValue[]
): Array<Tag & { values?: string[] }> => {
  // 按标签ID分组变量值（用于tags附加数据）
  const variablesByTagId: Record<string, string[]> = {};

  variableValues.forEach((value) => {
    if (!variablesByTagId[value.tag_id]) {
      variablesByTagId[value.tag_id] = [];
    }
    variablesByTagId[value.tag_id].push(value.value);
  });

  // 准备标签数据，保留id字段
  return tags.map((tag) => {
    // 对于变量标签，附加其值
    if (tag.isVariable) {
      return {
        ...tag, // 保留所有字段，包括id
        values: variablesByTagId[tag.id] || [],
      };
    }

    return tag; // 保留所有字段，包括id
  });
};

/**
 * 获取全局设置
 * @returns 全局设置对象
 */
const getGlobalSettings = (): { maxThreads: number; xToken: string } => {
  const defaultSettings = { maxThreads: 4, xToken: "" };

  if (typeof window === "undefined") return defaultSettings;

  try {
    const storedSettings = localStorage.getItem("droppable-tags-v2-global-settings");

    if (!storedSettings) return defaultSettings;

    const parsedSettings = JSON.parse(storedSettings);

    // 验证设置数据结构
    if (parsedSettings && typeof parsedSettings === "object") {
      // 确保 maxThreads 是有效数字
      if (typeof parsedSettings.maxThreads === "number" && !isNaN(parsedSettings.maxThreads)) {
        defaultSettings.maxThreads = parsedSettings.maxThreads;
      }
      // 确保 xToken 是字符串
      if (typeof parsedSettings.xToken === "string") {
        defaultSettings.xToken = parsedSettings.xToken;
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("加载全局设置失败:", error);
  }

  return defaultSettings;
};

/**
 * 准备提交数据
 * @param tags 标签数组
 * @param variableValues 变量值数组
 * @param taskName 任务名称
 * @returns 准备好的提交数据对象
 */
export const prepareSubmitData = async (
  tags: Tag[],
  variableValues: VariableValue[],
  taskName: string = "无标题任务" // 默认任务名称
): Promise<SubmitData> => {
  // 获取当前登录用户的名称
  const username = await getUsernameForSubmit();

  // 获取所有变量标签
  const variableTags = tags.filter((tag) => tag.isVariable);

  // 创建变量槽数据
  const variables = createVariableSlots(variableTags, variableValues);

  // 创建标签数据
  const tagData = createTagData(tags, variableValues);

  // 获取全局设置
  const globalSettings = getGlobalSettings();

  // 返回最终提交数据
  return {
    username,
    task_name: taskName,
    tags: tagData,
    variables,
    settings: {
      maxThreads: globalSettings.maxThreads,
      xToken: globalSettings.xToken,
    },
    createdAt: new Date().toISOString(),
  };
};

/**
 * 执行提交操作
 * @param data 提交数据
 * @returns Promise，解析为提交结果
 */
export const submitPost = async (data: SubmitData): Promise<SubmitResponse> => {
  try {
    // 记录提交数据（用于调试）
    // eslint-disable-next-line no-console
    console.log("===== 提交数据开始 =====");
    // eslint-disable-next-line no-console
    console.log("用户名:", data.username || "未指定");
    // eslint-disable-next-line no-console
    console.log("任务名称:", data.task_name || "无标题任务");
    // eslint-disable-next-line no-console
    console.log("标签数量:", data.tags?.length || 0);

    // 再次检查变量标签数量
    const variableTagsCount = data.tags?.filter((tag) => tag.isVariable).length || 0;

    // eslint-disable-next-line no-console
    console.log(`变量标签数量: ${variableTagsCount}`);

    if (variableTagsCount > 6) {
      throw new Error(`变量标签数量不能超过6个，当前有 ${variableTagsCount} 个`);
    }

    // 准备提交到API的数据
    const apiData = {
      task_name: data.task_name,
      username: data.username, // 添加用户名字段
      tags: data.tags.map((tag) => {
        // 如果是lumina类型，将其转换为element类型并确保包含所有必要信息
        const tagType = tag.type === "lumina" ? "element" : tag.type;

        // 如果是lumina类型，将其转换为element类型，但只保留指定的字段
        if (tag.type === "lumina") {
          // 检查必要字段是否存在
          if (!tag.value) {
            console.error("Lumina标签缺少必要字段:", tag);
            // 使用默认值创建一个完整的Lumina标签
            return {
              id: tag.id || Date.now().toString(),
              type: "element", // 使用element类型
              isVariable: tag.isVariable || false,
              value: "lumina1",
              color: "#cccccc",
              useGradient: false,
              uuid: "b5edccfe-46a2-4a14-a8ff-f4d430343805",
              header_img: "https://oss.talesofai.cn/picture_s/1y7f53e6itfn_0.jpeg",
              heat_score: 50,
              weight: 1,
            };
          }

          // 只保留指定的字段
          return {
            id: tag.id,
            type: tagType, // 使用转换后的类型
            isVariable: tag.isVariable,
            value: tag.value || "lumina1",
            color: tag.color || "#cccccc",
            useGradient: tag.useGradient || false,
            uuid: tag.uuid || "b5edccfe-46a2-4a14-a8ff-f4d430343805",
            header_img: tag.header_img || "https://oss.talesofai.cn/picture_s/1y7f53e6itfn_0.jpeg",
            heat_score: tag.heat_score || 50,
            weight: tag.weight || 1,
          };
        }

        // 其他类型的标签处理
        return {
          id: tag.id, // 保留id字段
          type: tagType, // 使用转换后的类型
          isVariable: tag.isVariable, // 使用isVariable而不是is_variable
          value: tag.value,
          color: tag.color || "#cccccc", // 添加color字段，提供默认值
          name: tag.name,
          weight: tag.weight,
          uuid: tag.uuid,
          header_img: tag.header_img,
          // 添加其他可能缺少的必需字段
          ...(tag.gradientToColor ? { gradientToColor: tag.gradientToColor } : {}),
          ...(tag.useGradient !== undefined ? { useGradient: tag.useGradient } : {}),
          ...(tag.heat_score !== undefined ? { heat_score: tag.heat_score } : {}),
        };
      }),
      variables: data.variables,
      settings: data.settings, // 直接使用全局设置
    };

    // eslint-disable-next-line no-console
    console.log("准备提交到API的数据:", apiData);

    // 使用统一的API服务发送请求
    const apiResponse = await apiService.task.createTask(apiData);

    // 检查响应
    // eslint-disable-next-line no-console
    console.log("API响应:", apiResponse);

    // 检查是否有错误
    if (apiResponse.error || (apiResponse.status && apiResponse.status >= 400)) {
      throw new Error(apiResponse.error || "提交失败");
    }

    // 显示成功通知
    showAlert({
      title: "提交成功",
      description: "任务已成功提交，可以在进度标签页查看任务状态。",
    });

    // 返回成功响应

    return {
      success: true,
      message: apiResponse.data?.message || "提交成功",
      timestamp: new Date().toISOString(),
      data: apiResponse.data,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("提交失败:", error);
    showAlert({
      title: "提交失败",
      description: error instanceof Error ? error.message : "发生未知错误",
      variant: "destructive",
    });
    throw error;
  }
};

/**
 * 计算将生成的图片总数
 * @param tags 标签数组
 * @param variableValues 变量值数组
 * @returns 图片总数
 */
export const calculateTotalImages = (tags: Tag[], variableValues: VariableValue[]): number => {
  // 默认生成一张图片
  let totalImages = 1;

  // 获取batch标签的值
  const batchTag = tags.find((tag) => tag.type === "batch" && !tag.isVariable);

  if (batchTag) {
    const batchValue = parseInt(batchTag.value);

    if (!isNaN(batchValue) && batchValue > 0) {
      totalImages *= batchValue;
    }
  }

  // 创建变量标签ID到变量名的映射
  const variableTagIdToName: Record<string, string> = {};

  tags.forEach((tag) => {
    if (tag.isVariable && tag.name) {
      variableTagIdToName[tag.id] = tag.name;
    }
  });

  // 按变量名分组变量值
  const variablesByName: Record<string, VariableValue[]> = {};

  variableValues.forEach((value) => {
    const variableName = variableTagIdToName[value.tag_id];

    if (variableName) {
      if (!variablesByName[variableName]) {
        variablesByName[variableName] = [];
      }
      variablesByName[variableName].push(value);
    }
  });

  // 计算变量组合数
  Object.values(variablesByName).forEach((values) => {
    if (values.length > 0) {
      totalImages *= values.length;
    }
  });

  return totalImages;
};

/**
 * 完整的提交流程:
 * 1. 验证数据
 * 2. 准备数据
 * 3. 提交数据
 * @param tags 标签数组
 * @param variableValues 变量值数组
 * @param taskName 任务名称
 * @returns Promise，解析为提交结果，或者如果验证失败则为null
 */
export const completeSubmitProcess = async (
  tags: Tag[],
  variableValues: VariableValue[],
  taskName: string = "无标题任务"
): Promise<SubmitResponse | null> => {
  // 第一步：验证
  // 先检查变量标签数量
  const variableTagsCount = tags.filter((tag) => tag.isVariable).length;

  if (variableTagsCount > 6) {
    showAlert({
      title: "提交失败",
      description: `变量标签数量不能超过6个，当前有 ${variableTagsCount} 个`,
      variant: "destructive",
    });

    return null;
  }

  // 执行其他验证
  if (!validateBeforeSubmit(tags, variableValues)) {
    return null;
  }

  // 第二步：准备数据
  const data = await prepareSubmitData(tags, variableValues, taskName);

  // 第三步：提交
  try {
    // 执行提交操作
    const result = await submitPost(data);

    // 提交成功后记录详细信息
    // eslint-disable-next-line no-console
    console.log("提交成功:", result);

    // 统计标签和变量数据
    const totalTagsCount = tags.length;
    const variableTagsCount = tags.filter((tag) => tag.isVariable).length;
    const variableNames = Object.keys(data.variables || {}).length;
    const totalVariableValues = Object.values(data.variables || {}).reduce((sum, variable) => {
      return sum + (variable.values ? variable.values.length : 0);
    }, 0);

    // 记录详细的统计信息
    // eslint-disable-next-line no-console
    // eslint-disable-next-line no-console
    console.log(`标签统计: 共 ${totalTagsCount} 个标签(其中变量标签 ${variableTagsCount} 个)`);
    // eslint-disable-next-line no-console
    // eslint-disable-next-line no-console
    console.log(`变量统计: 共 ${variableNames} 个变量(共 ${totalVariableValues} 个值)`);

    // 注意: submitPost函数已经显示了成功通知，这里不需要再显示

    return result;
  } catch (error) {
    // 错误已在submitPost中处理
    // eslint-disable-next-line no-console
    console.error("提交流程出错:", error);

    // 显示错误消息
    showAlert({
      title: "提交失败",
      description: error instanceof Error ? error.message : "发生未知错误",
      variant: "destructive",
    });

    return null;
  }
};
