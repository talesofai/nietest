"use client";

import React from "react";
import { Button } from "@heroui/react";
import { useDisclosure } from "@heroui/react";

import VTokenDisplay from "@/components/tags/vtoken/VTokenDisplay";
import {
  CharacterSearchModal,
  ElementSearchModal,
} from "@/components/tags/vtoken/VTokenSearchModal";
import { VTokenSelectorProps } from "@/types/vtoken";
import { SearchSelectItem } from "@/types/search";

/**
 * 令牌选择器组件
 * 用于选择角色或元素，并显示当前选中的项目
 */
const VTokenSelector: React.FC<VTokenSelectorProps> = ({
  name,
  type,
  header_img,
  onChange,
  onSelectItem,
  className = "",
  disabled = false,
}) => {
  // 搜索模态框控制
  const { isOpen, onOpen, onClose } = useDisclosure();

  // 处理项目选择
  const handleSelect = (item: SearchSelectItem) => {
    onChange(item.name);
    onSelectItem?.(item);
    onClose();
  };

  // 搜索模态框组件
  const SearchModal =
    type === "character" ? CharacterSearchModal : ElementSearchModal;

  return (
    <div className={`w-full ${className}`}>
      {name ? (
        <VTokenDisplay
          header_img={header_img}
          isDisabled={disabled}
          name={name}
          type={type}
          onClose={disabled ? undefined : onOpen}
        />
      ) : (
        <Button
          className="w-full"
          color="primary"
          isDisabled={disabled}
          size="sm"
          onPress={onOpen}
        >
          {type === "character" ? "角色选择" : "元素选择"}
        </Button>
      )}

      <SearchModal isOpen={isOpen} onClose={onClose} onSelect={handleSelect} />
    </div>
  );
};

export default VTokenSelector;
