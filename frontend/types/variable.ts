/**
 * 变量相关的类型定义
 */

/**
 * 变量值接口
 */
export interface VariableValue {
  variable_id: string; // 变量的id
  tag_id: string; // 对应tag的id
  value: string; // 变量的值
  weight?: number; // 权重(仅prompt/character/element/lumina类存在)
  uuid?: string; // 角色的uuid(仅character/element/lumina类存在)
  header_img?: string; // 角色的图像(仅character/element/lumina类存在)

  // Lumina类型的必要字段
  ref_uuid?: string; // 引用UUID
  short_name?: string; // 短名称
  status?: string; // 状态
  accessibility?: string; // 访问权限
  platform?: string; // 平台
  config?: any; // 配置信息
  type?: string; // 类型，用于标记elementum
}

/**
 * 变量配置接口
 */
export interface Variable {
  tag_id: string; // 对应的tag的id
  name: string; // 变量名称
  values: VariableValue[]; // 变量值数组
}

/**
 * 标准化变量结构
 */
export interface Variables {
  v0?: Variable; // 变量0
  v1?: Variable; // 变量1
  v2?: Variable; // 变量2
  v3?: Variable; // 变量3
  v4?: Variable; // 变量4
  v5?: Variable; // 变量5
  v6?: Variable; // 变量6
}
