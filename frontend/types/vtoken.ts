/**
 * VToken组件库类型定义
 */
import { ReactNode } from "react";
import { SearchSelectItem } from "./search";

/**
 * 角色数据接口
 */
export interface Character {
    uuid: string;
    type: string;
    name: string;
    avatar_img: string;
    header_img: string;
    heat_score: number;
}

/**
 * 元素数据接口
 * 与角色数据结构相同，但为了语义清晰单独定义
 */
export interface Element {
    uuid: string;
    type: string;
    name: string;
    avatar_img: string;
    header_img: string;
    heat_score: number;
}

/**
 * 令牌类型
 */
export type VTokenType = "character" | "element";

/**
 * 令牌显示属性接口
 */
export interface VTokenDisplayProps {
    /** 显示的名称 */
    name: string;
    /** 关闭按钮回调 */
    onClose?: () => void;
    /** 点击事件回调 */
    onClick?: () => void;
    /** 头像图片URL */
    header_img?: string;
    /** 类型: "character" | "element" */
    type: VTokenType;
    /** 自定义图标 */
    customIcon?: ReactNode;
    /** 是否禁用点击功能 */
    isDisabled?: boolean;
}

/**
 * 令牌选择器属性
 */
export interface VTokenSelectorProps {
    /**
     * 令牌类型
     */
    type: VTokenType;

    /**
     * 当前选中的令牌名称
     */
    name?: string;

    /**
     * 当前选中的令牌图片
     */
    header_img?: string;

    /**
     * 是否禁用
     */
    disabled?: boolean;

    /**
     * 令牌变更回调
     */
    onChange: (value: string) => void;

    /**
     * 选中项回调
     */
    onSelectItem?: (item: SearchSelectItem) => void;

    /**
     * 选择取消回调
     */
    onCancel?: () => void;

    /**
     * 容器类名
     */
    className?: string;
}

/**
 * 令牌管理器属性
 */
export interface VTokenManagerProps {
    /**
     * 令牌变更回调
     */
    onTokenChange?: (token: string | null) => void;

    /**
     * 默认令牌值
     */
    defaultToken?: string;

    /**
     * 是否默认展开
     */
    defaultExpanded?: boolean;
}

/**
 * 令牌搜索类型
 */
export type VTokenSearchType = VTokenType;

/**
 * 搜索模态框属性
 */
export interface VTokenSearchModalProps {
    /**
     * 是否打开
     */
    isOpen: boolean;

    /**
     * 关闭回调
     */
    onClose: () => void;

    /**
     * 选择回调
     */
    onSelect: (item: SearchSelectItem) => void;

    /**
     * 搜索类型
     */
    type: VTokenSearchType;
}