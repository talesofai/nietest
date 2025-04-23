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
  weight?: number; // 权重(仅prompt/character/element类存在)
  uuid?: string; // 角色的uuid(仅character/element类存在)
  header_img?: string; // 角色的图像(仅character/element类存在)
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
