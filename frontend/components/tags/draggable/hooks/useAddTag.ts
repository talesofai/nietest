import { useState, useRef } from "react";
import { alertService } from "@/utils/alertService";
import { Tag, TagType } from "@/types/tag";
import { VariableValue } from "@/types/variable";
import {
    getDefaultValueByType,
    isVariableNameUnique,
    isTypeUnique,
    isVariableNameLengthValid
} from "../tagUtils";
import { getRandomColorValue, getRandomGradientColors } from "@/config/colors";

/**
 * 添加标签自定义 Hook
 * 管理标签添加相关的状态和操作
 */
export const useAddTag = (
    tags: Tag[],
    setTags: React.Dispatch<React.SetStateAction<Tag[]>>,
    setVariableValues: React.Dispatch<React.SetStateAction<VariableValue[]>>
) => {
    // 控制添加表单显示状态
    const [showAddForm, setShowAddForm] = useState(false);

    // 预览颜色引用
    const previewColorRef = useRef(getRandomColorValue());
    const previewGradientColorRef = useRef(getRandomGradientColors());

    // 生成随机颜色
    const generateRandomColors = () => {
        previewColorRef.current = getRandomColorValue();
        previewGradientColorRef.current = getRandomGradientColors();
    };

    // 处理添加标签
    const handleAddTag = (data: {
        name: string;
        type: TagType;
        isVariable: boolean;
        value: string;
        uuid?: string;
        heat_score?: number;
        weight?: number;
        header_img?: string;
    }) => {
        // 获取预设的随机颜色和渐变色
        const colorValue = previewColorRef.current;
        const gradientConfig = previewGradientColorRef.current;

        // 对于变量标签，需要名称
        if (data.isVariable) {
            if (!data.name.trim()) {
                alertService.error("变量名称不能为空", "请输入变量名称");
                return;
            }

            // 检查变量名是否唯一
            if (!isVariableNameUnique(data.name, tags)) {
                alertService.error("变量名称重复", "变量名必须唯一");
                return;
            }

            // 检查变量名长度是否合法
            if (!isVariableNameLengthValid(data.name)) {
                alertService.error("变量名称过长", `变量名最长12个字符`);
                return;
            }
        }

        // 检查除了prompt类型和character类型外的标签唯一性
        if (!isTypeUnique(data.type, tags)) {
            alertService.error("标签类型重复", `只能有一个 ${data.type} 类型的标签`);
            return;
        }

        // 非变量标签必须有值
        if (!data.isVariable && !data.value.trim() && data.type === "prompt") {
            data.value = getDefaultValueByType(data.type);
        }

        // 使用默认值或用户输入的值
        const value = data.value.trim() ? data.value : getDefaultValueByType(data.type);

        // 根据标签类型决定是否使用渐变色
        const useGradient = data.isVariable;

        // 添加角色特有属性
        const newTag: Tag = {
            id: Date.now().toString(),
            type: data.type,
            isVariable: data.isVariable,
            color: previewColorRef.current,
            useGradient: useGradient,
            gradientToColor: useGradient ? gradientConfig.to : undefined,
            value: value,
            name: data.isVariable ? data.name : undefined,
            // 添加角色或元素特有属性
            uuid: (data.type === "character" || data.type === "element") ? data.uuid : undefined,
            header_img: (data.type === "character" || data.type === "element") ? data.header_img : undefined,
            heat_score: (data.type === "character" || data.type === "element") ? data.heat_score : undefined,
            // 添加权重属性，只有非变量的character/element/prompt类型才添加权重
            weight: (data.type === "character" || data.type === "element" || data.type === "prompt") && !data.isVariable ? data.weight : undefined
        };

        // 添加新标签
        setTags(prevTags => [...prevTags, newTag]);

        // 如果是变量标签，添加默认变量值
        if (newTag.isVariable) {
            if (newTag.type === "polish") {
                // 对于润色类型，创建true和false两个变量值
                const trueValue: VariableValue = {
                    variable_id: Date.now().toString() + '-true',
                    tag_id: newTag.id,
                    value: 'true'
                };

                const falseValue: VariableValue = {
                    variable_id: Date.now().toString() + '-false',
                    tag_id: newTag.id,
                    value: 'false'
                };

                setVariableValues(prev => [...prev, trueValue, falseValue]);
            } else {
                // 对于其他类型，创建默认值
                const defaultValue: VariableValue = {
                    variable_id: Date.now().toString() + '-default',
                    tag_id: newTag.id,
                    value: getDefaultValueByType(newTag.type),
                    // 如果是角色或元素类型，添加相关信息
                    ...((newTag.type === "character" || newTag.type === "element") ? {
                        uuid: data.uuid,
                        header_img: data.header_img
                    } : {})
                };

                setVariableValues(prev => [...prev, defaultValue]);
            }
        }

        // 重置添加标签窗口
        setShowAddForm(false);
    };

    // 渲染添加按钮相关的函数将保留在主组件中，因为它涉及UI渲染

    return {
        showAddForm,
        setShowAddForm,
        generateRandomColors,
        handleAddTag,
        previewColorRef,
        previewGradientColorRef
    };
};