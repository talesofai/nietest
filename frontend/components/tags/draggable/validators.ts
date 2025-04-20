import { Tag } from "@/types/tag";
import { VariableValue } from "@/types/variable";

/**
 * 验证标签数据
 * 确保所有标签都具有必需的字段和正确的数据类型
 * @param tags 要验证的标签数组
 * @returns 过滤后的有效标签数组
 */
export const validateTags = (tags: any[]): Tag[] => {
    if (!Array.isArray(tags)) return [];

    return tags.filter(tag => {
        // 确保标签有所有必需的字段
        return (
            tag &&
            typeof tag.id === 'string' &&
            typeof tag.type === 'string' &&
            typeof tag.isVariable === 'boolean' &&
            typeof tag.color === 'string' &&
            typeof tag.value === 'string'
        );
    });
};

/**
 * 验证变量值数据
 * 确保所有变量值都具有必需的字段并与有效标签关联
 * @param values 要验证的变量值数组
 * @param validTags 有效标签数组，用于验证关联
 * @returns 过滤后的有效变量值数组
 */
export const validateVariableValues = (values: any[], validTags: Tag[]): VariableValue[] => {
    if (!Array.isArray(values)) return [];

    // 获取所有有效标签ID列表，用于验证变量值关联
    const validTagIds = validTags.map(tag => tag.id);

    return values.filter(value => {
        // 确保变量值有所有必需的字段且关联到有效的标签
        return (
            value &&
            typeof value.variable_id === 'string' &&
            typeof value.tag_id === 'string' &&
            typeof value.value === 'string' &&
            validTagIds.includes(value.tag_id)
        );
    });
};