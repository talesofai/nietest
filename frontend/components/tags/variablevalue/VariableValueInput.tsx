"use client";

import React from "react";
import { Switch } from "@heroui/switch";
import { Input } from "@heroui/react";

import { Tag } from "@/types/tag";
import { VariableValue } from "@/types/variable";
import VTokenDisplay from "@/components/tags/vtoken/VTokenDisplay";
import { SearchSelectItem } from "@/types/search";

import { TagValueInput } from "../draggable/TagValueInput";

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
const isLuminaType = (type: string): type is "lumina" => type === "lumina";

// 这个类型谓词函数当前未被使用
// const isPromptType = (type: string): type is "prompt" => type === "prompt";

// 检查标签类型是否支持权重设置
const supportWeightSetting = (type: string): boolean => {
  return type === "prompt" || type === "character" || type === "element" || type === "lumina";
};

// 辅助函数获取变量值中的图像URL
const getImageUrl = (value: VariableValue): string | undefined => {
  return (value as any).header_img || (value as any).avatar;
};

/**
 * 渲染权重输入组件
 */
const WeightInput = ({
  weight,
  onWeightChange,
}: {
  weight?: number;
  onWeightChange?: (weight: number) => void;
}) => {
  if (!onWeightChange) return null;

  return (
    <div className="w-[100px] flex-shrink-0">
      <Input
        className="w-full"
        defaultValue="1"
        label="权重"
        max={2}
        min={0.05}
        size="sm"
        step={0.05}
        type="number"
        value={weight !== undefined ? weight.toString() : "1"}
        onChange={(e) => {
          const val = parseFloat(e.target.value);

          if (!isNaN(val) && val >= 0.05 && val <= 2) {
            onWeightChange(val);
          }
        }}
      />
    </div>
  );
};

/**
 * 处理角色选择事件
 */
const handleCharacterSelect = (
  value: VariableValue,
  onChange: (value: string) => void,
  character: SearchSelectItem
) => {
  // 通知父组件更新值
  onChange(character.name);

  // 创建自定义事件传递角色信息
  const event = new CustomEvent("character-selected", {
    detail: {
      valueId: (value as any).variable_id || (value as any).id,
      characterInfo: {
        name: character.name,
        uuid: character.uuid,
        header_img: character.header_img,
      },
    },
    bubbles: true,
  });

  document.dispatchEvent(event);
};

/**
 * 处理元素选择事件
 */
const handleElementSelect = (
  value: VariableValue,
  onChange: (value: string) => void,
  element: SearchSelectItem
) => {
  // 通知父组件更新值
  onChange(element.name);

  // 创建自定义事件传递元素信息
  const event = new CustomEvent("element-selected", {
    detail: {
      valueId: (value as any).variable_id || (value as any).id,
      elementInfo: {
        name: element.name,
        uuid: element.uuid,
        header_img: element.header_img,
      },
    },
    bubbles: true,
  });

  document.dispatchEvent(event);
};

/**
 * 处理Lumina选择事件
 */
const handleLuminaSelect = (
  value: VariableValue,
  onChange: (value: string) => void,
  lumina: SearchSelectItem
) => {
  // 通知父组件更新值
  onChange(lumina.name);

  // 创建自定义事件传递Lumina信息
  const event = new CustomEvent("lumina-selected", {
    detail: {
      valueId: (value as any).variable_id || (value as any).id,
      luminaInfo: {
        name: lumina.name,
        uuid: lumina.uuid,
        header_img: lumina.header_img,
        // 添加其他必要的字段
        ref_uuid: (lumina as any).ref_uuid || "",
        short_name: (lumina as any).short_name || lumina.name,
        status: (lumina as any).status || "PUBLISHED",
        accessibility: (lumina as any).accessibility || "PUBLIC",
        platform: (lumina as any).platform || "nieta-app",
        config: lumina.config || {
          header_img: lumina.header_img,
          avatar_img: lumina.header_img,
        },
        type: "elementum",
      },
    },
    bubbles: true,
  });

  document.dispatchEvent(event);
};

/**
 * 渲染角色、元素或Lumina类型的输入组件
 */
const CharacterOrElementInput = ({
  tag,
  value,
  onChange,
  onWeightChange,
  onFocus,
  onBlur,
}: VariableValueInputProps) => {
  const imageUrl = getImageUrl(value);

  // 如果有图像，显示角色/元素/Lumina信息和权重滑块
  if (imageUrl) {
    return (
      <div className="flex items-center gap-2 w-full">
        <div className="flex-grow">
          <VTokenDisplay header_img={imageUrl} name={value.value} type={tag.type === "lumina" ? "element" : tag.type} />
        </div>
        <WeightInput weight={value.weight} onWeightChange={onWeightChange} />
      </div>
    );
  }

  // 如果没有图像，显示标准输入和权重滑块
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-grow">
        <TagValueInput
          header_img={imageUrl}
          type={tag.type}
          value={value.value}
          onBlur={onBlur}
          onChange={onChange}
          onFocus={onFocus}
          onSelectCharacter={
            isCharacterType(tag.type)
              ? (character) => handleCharacterSelect(value, onChange, character)
              : undefined
          }
          onSelectElement={
            isElementType(tag.type)
              ? (element) => handleElementSelect(value, onChange, element)
              : undefined
          }
          onSelectLumina={
            isLuminaType(tag.type)
              ? (lumina) => handleLuminaSelect(value, onChange, lumina)
              : undefined
          }
        />
      </div>
      <WeightInput weight={value.weight} onWeightChange={onWeightChange} />
    </div>
  );
};

/**
 * 渲染提示词类型的输入组件
 */
const PromptInput = ({
  tag,
  value,
  onChange,
  onWeightChange,
  onFocus,
  onBlur,
}: VariableValueInputProps) => {
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-grow">
        <TagValueInput
          type={tag.type}
          value={value.value}
          onBlur={onBlur}
          onChange={onChange}
          onFocus={onFocus}
        />
      </div>
      {supportWeightSetting(tag.type) && (
        <WeightInput weight={value.weight} onWeightChange={onWeightChange} />
      )}
    </div>
  );
};

/**
 * 变量值输入组件，为不同类型的变量提供专用输入控件
 */
const VariableValueInput: React.FC<VariableValueInputProps> = (props) => {
  const { value, tag, onChange, onFocus, onBlur } = props;

  // 如果是润色测试变量，只能使用开关
  if (tag.type === "polish") {
    return (
      <div className="flex items-center gap-2 flex-grow">
        <span className="text-sm font-medium">{value.value === "true" ? "启用" : "禁用"}</span>
        <Switch
          className="ml-2"
          isDisabled={true} // 不允许修改，固定为true/false
          isSelected={value.value === "true"}
          size="sm"
        />
        <span className="text-xs text-gray-500 ml-auto">(不可修改)</span>
      </div>
    );
  }

  // 如果是角色、元素或Lumina类型
  if (tag.type === "character" || tag.type === "element" || tag.type === "lumina") {
    return <CharacterOrElementInput {...props} />;
  }

  // 对prompt类型
  if (tag.type === "prompt") {
    return <PromptInput {...props} />;
  }

  // 其他类型使用标准标签值输入组件
  return (
    <TagValueInput
      header_img={getImageUrl(value)}
      type={tag.type}
      value={value.value}
      onBlur={onBlur}
      onChange={onChange}
      onFocus={onFocus}
      onSelectCharacter={
        isCharacterType(tag.type)
          ? (character) => handleCharacterSelect(value, onChange, character)
          : undefined
      }
      onSelectElement={
        isElementType(tag.type)
          ? (element) => handleElementSelect(value, onChange, element)
          : undefined
      }
      onSelectLumina={
        isLuminaType(tag.type)
          ? (lumina) => handleLuminaSelect(value, onChange, lumina)
          : undefined
      }
    />
  );
};

export default VariableValueInput;
