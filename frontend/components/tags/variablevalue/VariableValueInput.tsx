"use client";

import React from "react";
import { Switch } from "@heroui/switch";
import { Input } from "@heroui/react";
import { Tag } from "@/types/tag";
import { VariableValue } from "@/types/variable";
import { TagValueInput } from "../draggable/TagValueInput";
import VTokenDisplay from "@/components/tags/vtoken/VTokenDisplay";
import { SearchSelectItem } from "@/types/search";

interface VariableValueInputProps {
    value: VariableValue;
    tag: Tag;
    onChange: (value: string) => void;
    onWeightChange?: (weight: number | undefined) => void;
    onFocus?: () => void;
    onBlur?: () => void;
}

// 添加类型谓词函数
const isCharacterType = (type: string): type is "character" => type === "character";
const isElementType = (type: string): type is "element" => type === "element";
const isPromptType = (type: string): type is "prompt" => type === "prompt";

// 检查标签类型是否支持权重设置
const supportWeightSetting = (type: string): boolean => {
    return type === "prompt" || type === "character" || type === "element";
};

// 辅助函数获取变量值中的图像URL
const getImageUrl = (value: VariableValue): string | undefined => {
    return (value as any).header_img || (value as any).avatar;
};

/**
 * 变量值输入组件，为不同类型的变量提供专用输入控件
 */
const VariableValueInput: React.FC<VariableValueInputProps> = ({ value, tag, onChange, onWeightChange, onFocus, onBlur }) => {
    // 如果是润色测试变量，只能使用开关
    if (tag.type === "polish") {
        return (
            <div className="flex items-center gap-2 flex-grow">
                <span className="text-sm font-medium">{value.value === "true" ? "启用" : "禁用"}</span>
                <Switch
                    size="sm"
                    isSelected={value.value === "true"}
                    isDisabled={true} // 不允许修改，固定为true/false
                    className="ml-2"
                />
                <span className="text-xs text-gray-500 ml-auto">(不可修改)</span>
            </div>
        );
    }

    // 处理角色选择，更新角色相关信息
    const handleCharacterSelect = (character: SearchSelectItem) => {
        // 通知父组件更新值
        onChange(character.name);

        // 创建自定义事件传递角色信息
        const event = new CustomEvent('character-selected', {
            detail: {
                valueId: (value as any).variable_id || (value as any).id,
                characterInfo: {
                    name: character.name,
                    uuid: character.uuid,
                    header_img: character.header_img
                }
            },
            bubbles: true
        });
        document.dispatchEvent(event);
    };

    // 处理元素选择，更新元素相关信息
    const handleElementSelect = (element: SearchSelectItem) => {
        // 通知父组件更新值
        onChange(element.name);

        // 创建自定义事件传递元素信息
        const event = new CustomEvent('element-selected', {
            detail: {
                valueId: (value as any).variable_id || (value as any).id,
                elementInfo: {
                    name: element.name,
                    uuid: element.uuid,
                    header_img: element.header_img
                }
            },
            bubbles: true
        });
        document.dispatchEvent(event);
    };

    // 注意: 我们已经在下面的代码中处理了角色和元素类型的显示

    // 如果是角色或元素类型，显示标签值输入和权重输入
    if (tag.type === "character" || tag.type === "element") {
        // 获取图像URL
        const imageUrl = getImageUrl(value);

        // 如果有图像，显示角色/元素信息和权重滑块
        if (imageUrl) {
            return (
                <div className="flex items-center gap-2 w-full">
                    <div className="flex-grow">
                        <VTokenDisplay
                            name={value.value}
                            type={tag.type}
                            header_img={imageUrl}
                        />
                    </div>
                    {onWeightChange && (
                        <div className="w-[100px] flex-shrink-0">
                            <Input
                                type="number"
                                size="sm"
                                label="权重"
                                min={0.05}
                                max={2}
                                step={0.05}
                                defaultValue="1"
                                value={value.weight !== undefined ? value.weight.toString() : "1"}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val) && val >= 0.05 && val <= 2) {
                                        onWeightChange(val);
                                    }
                                }}
                                className="w-full"
                            />
                        </div>
                    )}
                </div>
            );
        }

        // 如果没有图像，显示标准输入和权重滑块
        return (
            <div className="flex items-center gap-2 w-full">
                <div className="flex-grow">
                    <TagValueInput
                        value={value.value}
                        type={tag.type}
                        onChange={onChange}
                        onSelectCharacter={isCharacterType(tag.type) ? handleCharacterSelect : undefined}
                        onSelectElement={isElementType(tag.type) ? handleElementSelect : undefined}
                        onFocus={onFocus}
                        onBlur={onBlur}
                        header_img={imageUrl}
                    />
                </div>
                {onWeightChange && (
                    <div className="w-[100px] flex-shrink-0">
                        <Input
                            type="number"
                            size="sm"
                            label="权重"
                            min={0.05}
                            max={2}
                            step={0.05}
                            defaultValue="1"
                            value={value.weight !== undefined ? value.weight.toString() : "1"}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val >= 0.05 && val <= 2) {
                                    onWeightChange(val);
                                }
                            }}
                            className="w-full"
                        />
                    </div>
                )}
            </div>
        );
    }

    // 对prompt类型也添加权重设置功能
    if (tag.type === "prompt") {
        return (
            <div className="flex items-center gap-2 w-full">
                <div className="flex-grow">
                    <TagValueInput
                        value={value.value}
                        type={tag.type}
                        onChange={onChange}
                        onFocus={onFocus}
                        onBlur={onBlur}
                    />
                </div>
                {supportWeightSetting(tag.type) && onWeightChange && (
                    <div className="w-[100px] flex-shrink-0">
                        <Input
                            type="number"
                            size="sm"
                            label="权重"
                            min={0.05}
                            max={2}
                            step={0.05}
                            defaultValue="1"
                            value={value.weight !== undefined ? value.weight.toString() : "1"}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val >= 0.05 && val <= 2) {
                                    onWeightChange(val);
                                }
                            }}
                            className="w-full"
                        />
                    </div>
                )}
            </div>
        );
    }

    // 其他类型使用标准标签值输入组件，传递 onFocus 和 onBlur
    return (
        <TagValueInput
            value={value.value}
            type={tag.type}
            onChange={onChange}
            onSelectCharacter={isCharacterType(tag.type) ? handleCharacterSelect : undefined}
            onSelectElement={isElementType(tag.type) ? handleElementSelect : undefined}
            onFocus={onFocus}
            onBlur={onBlur}
            header_img={getImageUrl(value)}
        />
    );
};

export default VariableValueInput;