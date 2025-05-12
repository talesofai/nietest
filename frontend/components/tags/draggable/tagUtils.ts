import { TagType } from "@/types/tag";
import { Variables, Variable, VariableValue } from "@/types/variable";
import { Tag } from "@/types/tag";

/**
 * 常量配置区域
 */
// 最大变量名长度限制
export const MAX_VARIABLE_NAME_LENGTH = 12;

// 截断文本的默认最大长度
export const DEFAULT_TEXT_TRUNCATE_LENGTH = 23;

// 图像比例选项
export const ratioOptions = [
  { value: "1:1", label: "1:1" },
  { value: "2:3", label: "2:3" },
  { value: "3:2", label: "3:2" },
  { value: "3:4", label: "3:4" },
  { value: "4:3", label: "4:3" },
  { value: "3:5", label: "3:5" },
  { value: "5:3", label: "5:3" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
];

/**
 * 预设变量名映射
 * 为每种标签类型（除batch和character外）提供默认变量名
 */
export const RESERVED_VARIABLE_NAMES: Record<Exclude<TagType, "batch" | "character">, string> = {
  ratio: "比例测试",
  seed: "种子测试",
  polish: "润色测试",
  prompt: "", // prompt 类型不使用预设名，但包含在类型中避免索引错误
  element: "元素测试", // 添加元素类型的预设变量名
  lumina: "Lumina测试", // 添加Lumina类型的预设变量名
  ckpt_name: "lumina模型测试", // 添加ckpt_name类型的预设变量名
  steps: "lumina步数测试", // 添加steps类型的预设变量名
  cfg: "luminacfg测试", // 添加cfg类型的预设变量名
};

/**
 * 标签类型选项配置
 * 用于UI显示和类型转换
 */
export const TAG_TYPE_OPTIONS = [
  { key: "prompt", label: "提示词" },
  { key: "ratio", label: "比例" },
  { key: "batch", label: "批次" },
  { key: "seed", label: "种子" },
  { key: "polish", label: "润色" },
  { key: "character", label: "角色" },
  { key: "element", label: "元素" },
  { key: "lumina", label: "Lumina" },
  { key: "ckpt_name", label: "Lumina模型" },
  { key: "steps", label: "Lumina步数" },
  { key: "cfg", label: "LuminaCFG" },
] as const;

// 标签类型到显示名称的映射缓存，提高性能
const TYPE_DISPLAY_NAME_MAP = new Map<TagType, string>(
  TAG_TYPE_OPTIONS.map((option) => [option.key as TagType, option.label])
);

/**
 * 根据标签类型获取默认值
 * @param type 标签类型
 * @returns 对应类型的默认值
 */
export const getDefaultValueByType = (type: TagType): string => {
  switch (type) {
    case "prompt":
      return "";
    case "ratio":
      return "3:5";
    case "batch":
      return "1";
    case "seed":
      return "0";
    case "polish":
      return "false";
    case "character":
      return "";
    case "element":
      return "";
    case "lumina":
      return "";
    case "ckpt_name":
      return "1.pth";
    case "steps":
      return "1";
    case "cfg":
      return "7.5";
    default:
      return "";
  }
};

/**
 * 获取标签类型的显示名称
 * @param type 标签类型
 * @returns 用于显示的名称
 */
export const getTypeDisplayName = (type: TagType): string => {
  // 使用缓存的映射表，比重复查找更高效

  return TYPE_DISPLAY_NAME_MAP.get(type) || type;
};

/**
 * 检查变量名在现有标签中是否唯一
 * @param name 要检查的变量名
 * @param tags 现有标签列表
 * @returns 变量名是否唯一
 */
export const isVariableNameUnique = (name: string, tags: Tag[]): boolean => {
  return !tags.some((tag) => tag.isVariable && tag.name === name);
};

/**
 * 检查变量名长度是否合法
 * @param name 要检查的变量名
 * @returns 变量名长度是否合法
 */
export const isVariableNameLengthValid = (name: string): boolean => {
  return name.length <= MAX_VARIABLE_NAME_LENGTH;
};

/**
 * 截断文本并添加省略号，用于UI显示
 * @param text 要截断的文本
 * @param maxLength 最大允许长度，默认为23
 * @returns 截断后的文本
 */
export const truncateText = (
  text: string,
  maxLength: number = DEFAULT_TEXT_TRUNCATE_LENGTH
): string => {
  if (!text || text.length <= maxLength) return text;

  return text.substring(0, maxLength) + "...";
};

/**
 * 检查标签类型在标签列表中是否唯一
 * @param type 要检查的标签类型
 * @param tags 现有标签列表
 * @returns 类型是否唯一
 */
export const isTypeUnique = (type: TagType, tags: Tag[]): boolean => {
  // prompt、character、element和lumina类型可以有多个
  if (type === "prompt" || type === "character" || type === "element" || type === "lumina") return true;

  // 检查ckpt_name、steps和cfg标签，这些标签只有在存在lumina1元素时才能添加
  if (type === "ckpt_name" || type === "steps" || type === "cfg") {
    // 检查是否已经存在相同类型的标签
    if (tags.some((tag) => tag.type === type)) {
      return false;
    }

    // 检查是否存在lumina1元素
    const hasLumina1 = tags.some(tag =>
      tag.type === "lumina" &&
      tag.value === "lumina1" &&
      !tag.isVariable
    );

    // 只有在存在lumina1元素时才能添加这些标签
    return hasLumina1;
  }

  // 其他类型每种只能有一个
  return !tags.some((tag) => tag.type === type);
};

/**
 * 为新变量找到一个可用的变量槽位
 * @param variables 现有变量配置
 * @returns 可用的变量槽位键名，如果都已使用则返回null
 */
export const findAvailableVariableSlot = (variables: Variables): string | null => {
  // 检查v0到v6是否有可用槽位
  for (const key of ["v0", "v1", "v2", "v3", "v4", "v5", "v6"]) {
    if (!variables[key as keyof Variables] || !variables[key as keyof Variables]?.name) {
      return key;
    }
  }

  return null; // 所有槽位都已使用
};

/**
 * 创建变量配置对象
 * @param tag 标签对象
 * @returns 变量配置对象
 */
export const createVariableFromTag = (tag: Tag): Variable => {
  return {
    tag_id: tag.id,
    name: tag.name || getTypeDisplayName(tag.type),
    values: [], // 初始没有值
  };
};

/**
 * 添加变量值到变量配置中
 * @param variable 变量配置
 * @param value 要添加的值
 * @param weight 权重（可选）
 * @param uuid 角色/元素UUID（可选）
 * @param header_img 角色/元素头像（可选）
 * @returns 更新后的变量配置
 */
export const addVariableValue = (
  variable: Variable,
  value: string,
  weight?: number,
  uuid?: string,
  header_img?: string
): Variable => {
  // 创建新的变量值对象
  const newValue: VariableValue = {
    variable_id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, // 生成唯一ID
    tag_id: variable.tag_id,
    value,
  };

  // 根据标签类型添加额外字段
  if (weight !== undefined) {
    newValue.weight = weight;
  }

  if (uuid) {
    newValue.uuid = uuid;
  }

  if (header_img) {
    newValue.header_img = header_img;
  }

  // 返回更新后的变量配置

  return {
    ...variable,
    values: [...variable.values, newValue],
  };
};

/**
 * 从变量配置中删除变量值
 * @param variable 变量配置
 * @param variableId 要删除的变量值ID
 * @returns 更新后的变量配置
 */
export const removeVariableValue = (variable: Variable, variableId: string): Variable => {
  return {
    ...variable,
    values: variable.values.filter((v) => v.variable_id !== variableId),
  };
};

/**
 * 获取标签的显示文本
 * @param tag 标签对象
 * @returns 用于显示的文本
 */
export const getTagDisplayText = (tag: Tag): string => {
  if (tag.isVariable) {
    return `${tag.name || getTypeDisplayName(tag.type)} [变量]`;
  }

  // 根据标签类型不同显示不同的文本格式
  switch (tag.type) {
    case "prompt":
      let promptText = tag.value;

      if (tag.weight !== undefined && tag.weight !== 1) {
        promptText += ` [${tag.weight}]`;
      }

      return promptText;
    case "character":
    case "element":
    case "lumina":
      let text = tag.value;

      if (tag.weight !== undefined && tag.weight !== 1) {
        text += ` [${tag.weight}]`;
      }

      return text;
    default:
      return `${getTypeDisplayName(tag.type)}: ${tag.value}`;
  }
};
