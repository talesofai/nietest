"use client";

import React, { KeyboardEvent, useRef, useEffect, ChangeEvent } from "react";
import { Input, Switch, Button } from "@heroui/react";
import { useDisclosure } from "@heroui/react";

import { ratioOptions } from "@/components/tags/draggable/tagUtils";
import {
  CharacterSearchModal,
  ElementSearchModal,
} from "@/components/tags/vtoken/VTokenSearchModal";
import VTokenDisplay from "@/components/tags/vtoken/VTokenDisplay";
import { SearchSelectItem } from "@/types/search";

interface TagValueInputProps {
  type: string;
  value: string;
  onChange?: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  onEnterPress?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  onSelectCharacter?: (character: SearchSelectItem) => void;
  onSelectElement?: (element: SearchSelectItem) => void;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  header_img?: string;
}

/**
 * 标签值输入组件，根据标签类型提供不同的输入控件
 */
export const TagValueInput = ({
  type,
  value,
  onChange,
  onKeyDown,
  onEnterPress,
  placeholder,
  autoFocus,
  onSelectCharacter,
  onSelectElement,
  className,
  onFocus,
  onBlur,
  header_img,
}: TagValueInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const switchRef = useRef<HTMLInputElement>(null);

  // 角色搜索模态框控制
  const {
    isOpen: isCharacterSearchOpen,
    onOpen: onCharacterSearchOpen,
    onClose: onCharacterSearchClose,
  } = useDisclosure();

  // 元素搜索模态框控制
  const {
    isOpen: isElementSearchOpen,
    onOpen: onElementSearchOpen,
    onClose: onElementSearchClose,
  } = useDisclosure();

  // 处理键盘事件，支持回车键提交
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onEnterPress?.();
      onKeyDown?.(e);
    }
  };

  // 处理角色选择
  const handleCharacterSelect = (character: SearchSelectItem) => {
    if (onChange) {
      onChange(character.name);
    }

    if (onSelectCharacter) {
      onSelectCharacter(character);
    }

    onCharacterSearchClose();
  };

  // 处理元素选择
  const handleElementSelect = (element: SearchSelectItem) => {
    if (onChange) {
      onChange(element.name);
    }

    if (onSelectElement) {
      onSelectElement(element);
    }

    onElementSearchClose();
  };

  // 自动聚焦
  useEffect(() => {
    if (autoFocus) {
      if (type === "prompt" || type === "batch" || type === "seed") {
        inputRef.current?.focus();
      } else if (type === "ratio") {
        selectRef.current?.focus();
      }
    }
  }, [type, autoFocus]);

  // 创建一个通用的包装容器样式，确保所有类型输入控件高度一致
  const wrapperClassName = `h-[32px] flex items-center w-full ${className || ""}`;

  switch (type) {
    case "prompt":
      return (
        <div className={wrapperClassName}>
          <Input
            ref={inputRef}
            className="w-full"
            placeholder={placeholder}
            size="sm"
            value={value}
            onBlur={onBlur}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onChange?.(e.target.value)
            }
            onFocus={onFocus}
            onKeyDown={handleKeyDown}
          />
        </div>
      );

    case "character":
      return (
        <div className={wrapperClassName}>
          {value ? (
            <VTokenDisplay
              header_img={header_img}
              name={value}
              type="character"
              onClose={onCharacterSearchOpen}
            />
          ) : (
            <Button
              className="w-full"
              color="primary"
              size="sm"
              onPress={onCharacterSearchOpen}
            >
              角色选择
            </Button>
          )}

          <CharacterSearchModal
            isOpen={isCharacterSearchOpen}
            onClose={onCharacterSearchClose}
            onSelect={handleCharacterSelect}
          />
        </div>
      );

    case "element":
      return (
        <div className={wrapperClassName}>
          {value ? (
            <VTokenDisplay
              header_img={header_img}
              name={value}
              type="element"
              onClose={onElementSearchOpen}
            />
          ) : (
            <Button
              className="w-full"
              color="primary"
              size="sm"
              onPress={onElementSearchOpen}
            >
              元素选择
            </Button>
          )}

          <ElementSearchModal
            isOpen={isElementSearchOpen}
            onClose={onElementSearchClose}
            onSelect={handleElementSelect}
          />
        </div>
      );

    case "ratio":
      return (
        <div className={wrapperClassName}>
          <select
            ref={selectRef}
            className="w-full text-sm h-[32px] px-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={value}
            onBlur={onBlur}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              onChange?.(e.target.value)
            }
            onFocus={onFocus}
          >
            {ratioOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );

    case "batch":
      return (
        <div className={wrapperClassName}>
          <Input
            ref={inputRef}
            className="flex-grow"
            max={16}
            min={1}
            placeholder="批次大小"
            size="sm"
            type="number"
            value={value}
            onBlur={onBlur}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const numValue = parseInt(e.target.value);

              if (!isNaN(numValue) && numValue >= 1 && numValue <= 16) {
                onChange?.(numValue.toString());
              }
            }}
            onFocus={onFocus}
            onKeyDown={handleKeyDown}
          />
        </div>
      );

    case "seed":
      return (
        <div className={wrapperClassName}>
          <Input
            ref={inputRef}
            className="flex-grow"
            min={0}
            placeholder="输入种子数值"
            size="sm"
            type="number"
            value={value}
            onBlur={onBlur}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const numValue = parseInt(e.target.value);

              if (!isNaN(numValue) && numValue >= 0) {
                onChange?.(numValue.toString());
              }
            }}
            onFocus={onFocus}
            onKeyDown={handleKeyDown}
          />
        </div>
      );

    case "polish":
      return (
        <div className={wrapperClassName}>
          <div className="flex items-center gap-2 w-full">
            <span className="text-sm">启用润色:</span>
            <Switch
              ref={switchRef}
              isSelected={value === "true"}
              size="sm"
              onBlur={onBlur}
              onFocus={onFocus}
              onValueChange={(checked: boolean) =>
                onChange?.(checked.toString())
              }
            />
          </div>
        </div>
      );

    default:
      return <div className={wrapperClassName}>未知类型</div>;
  }
};
