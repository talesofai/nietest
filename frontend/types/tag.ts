/**
 * 标签相关的类型定义
 */

/**
 * 标签类型
 */
export type TagType = "prompt" | "ratio" | "batch" | "seed" | "polish" | "character" | "element" | "lumina";

/**
 * 标签数据接口
 */
export interface Tag {
  id: string; // 前端用的唯一标识
  type: TagType; // tag_type
  isVariable: boolean; // 是否是变量
  value: string; // 标签值
  color: string; // UI显示用的颜色
  gradientToColor?: string; // 渐变色终点
  useGradient?: boolean; // 是否使用渐变
  weight?: number; // 权重，用于prompt/character/element类型
  uuid?: string; // 角色或元素UUID
  name?: string; // 变量名称，只有变量标签需要
  header_img?: string; // 角色或元素封面图
  heat_score?: number; // 热度分数

  // Lumina类型的必要字段
  ref_uuid?: string; // 引用UUID
  short_name?: string; // 短名称
  status?: string; // 状态
  accessibility?: string; // 访问权限
  platform?: string; // 平台
  config?: any; // 配置信息
}
