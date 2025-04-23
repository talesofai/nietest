/**
 * 搜索相关的类型定义, 已经完整实现，不要变动
 */

/**
 * 搜索类型枚举
 */
export enum SearchType {
  CHARACTER = "character", // 角色
  ELEMENT = "element", // 元素
}

/**
 * 搜索查询数据接口
 */
export interface SearchQueryData {
  keywords: string; // 搜索的关键词
  page_index: number; // 页码
  page_size: number; // 每页的数量
}

/**
 * 搜索结果项接口
 */
export interface SearchResultItem {
  uuid: string; // 角色或元素的uuid
  type: SearchType | string; // 角色或元素的类型
  name: string; // 角色或元素的名称
  header_img: string; // 角色或元素的封面
  heat_score: number; // 热度分数
  config?: Record<string, any>; // 可能包含的额外配置信息
}

/**
 * 搜索响应的元数据
 */
export interface SearchMetadata {
  total_size: number; // 总结果数量
  total_page_size: number; // 总页数
  page_index: number; // 当前页码
  page_size: number; // 每页数量
}

/**
 * 搜索结果接口
 */
export interface SearchResult {
  data: SearchResultItem[]; // 搜索结果数据
  metadata: SearchMetadata; // 完整的元数据信息
}

/**
 * 搜索响应接口
 */
export interface SearchResponse {
  data?: SearchResultItem[]; // 搜索结果数据
  metadata?: SearchMetadata; // 元数据
  error?: string; // 错误信息
  status?: number; // 状态码
}

/**
 * 搜索选择项，用于组件间传递选中的项
 */
export interface SearchSelectItem extends Omit<SearchResultItem, "config"> {
  label?: string;
  value?: string;
  type: SearchType | string; // 确保type字段始终存在
}
