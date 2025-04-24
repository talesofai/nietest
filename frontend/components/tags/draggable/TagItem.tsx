"use client";

import React, { useState, useMemo } from "react";
import { motion, Reorder } from "framer-motion";
import { Button } from "@heroui/react";
import Image from "next/image";

import { Tag } from "@/types/tag";
import { getTagDisplayText } from "@/components/tags/draggable/tagUtils";
import { CloseIcon } from "@/components/icons";

import ColorButton from "../../ColorButton";

// 动画配置常量
const ANIMATION_CONFIG = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.8 },
  transition: {
    type: "spring",
    stiffness: 500,
    damping: 30,
    bounce: 0.2,
  },
  dragTransition: {
    bounceStiffness: 500,
    bounceDamping: 50,
  },
  whileDrag: {
    zIndex: 10,
    scale: 1.05,
    boxShadow: "0px 5px 10px rgba(0,0,0,0.1)",
    opacity: 1,
  },
};

interface TagItemProps {
  tag: Tag;
  onEdit: () => void;
  onRemove: () => void;
  onToggleVariable: () => void;
  value: Tag; // 用于Reorder.Item的value属性
}

/**
 * 标签项组件 - 使用 Framer Motion 的动画效果和拖拽功能
 * 支持拖拽排序、点击编辑和删除操作
 */
const TagItem: React.FC<TagItemProps> = ({
  tag,
  onEdit,
  onRemove,
  // onToggleVariable, // 未使用的参数
  value,
}) => {
  // 点击与拖拽区分状态
  const [isDragging, setIsDragging] = useState(false);

  // 处理点击事件，只有在没有拖拽时才触发编辑
  const handleClick = () => {
    if (!isDragging) {
      onEdit();
    }
  };

  // 使用 useMemo 缓存按钮样式计算结果
  const buttonVariant = useMemo(() => {
    // 变量标签总是使用shadow样式
    if (tag.isVariable) {
      return "shadow";
    }

    // 所有非变量标签使用solid样式

    return "solid";
  }, [tag.isVariable]);

  // 使用 useMemo 缓存显示文本，避免重复计算
  const displayText = useMemo(() => {
    // 移除角色或元素的图像信息，仅保留名称
    if (tag.type === "character" || tag.type === "element") {
      return tag.weight !== undefined && tag.weight !== 1
        ? `${tag.value} [${tag.weight}]`
        : tag.value;
    }

    return getTagDisplayText(tag);
  }, [tag]);

  return (
    <Reorder.Item
      animate={ANIMATION_CONFIG.animate}
      className="relative hide-drag-indicator"
      dragListener={true}
      dragSnapToOrigin={false}
      dragTransition={ANIMATION_CONFIG.dragTransition}
      exit={ANIMATION_CONFIG.exit}
      initial={ANIMATION_CONFIG.initial}
      layoutId={tag.id}
      transition={ANIMATION_CONFIG.transition}
      value={value}
      whileDrag={ANIMATION_CONFIG.whileDrag}
      onDragEnd={() => setTimeout(() => setIsDragging(false), 100)}
      onDragStart={() => setIsDragging(true)}
    >
      <div className="relative group">
        <div className="flex items-center cursor-move group-hover:scale-105 transition-transform">
          <ColorButton
            className="relative pl-1 pr-2 py-1"
            gradientToColor={tag.gradientToColor}
            hexColor={tag.color}
            useGradient={tag.useGradient}
            variant={buttonVariant}
            onPress={handleClick}
          >
            {/* 左侧图片 - 如果是角色或元素类型则显示 */}
            {(tag.type === "character" || tag.type === "element") && tag.header_img && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 inline-block">
                  <Image
                    alt={tag.value}
                    className="w-full h-full object-cover"
                    height={24}
                    src={tag.header_img}
                    width={24}
                    onError={(e) => {
                      const text = tag.type === "character" ? "角" : "元";
                      const target = e.target as HTMLImageElement;

                      target.src = `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Crect width="40" height="40" fill="%23dddddd"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="12" fill="%23888888" text-anchor="middle" dominant-baseline="middle"%3E${text}%3C/text%3E%3C/svg%3E`;
                    }}
                  />
                </div>
                <span>{displayText}</span>
              </div>
            )}

            {/* 普通标签内容 */}
            {!(tag.type === "character" || tag.type === "element") && <span>{displayText}</span>}
          </ColorButton>
        </div>

        {/* 删除按钮 - 悬停时显示 */}
        <motion.div
          animate={{ scale: 1 }}
          className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          initial={{ scale: 0.5 }}
        >
          <Button
            isIconOnly
            className="rounded-full"
            color="danger"
            size="sm"
            variant="shadow"
            onPress={() => {
              onRemove();
            }}
          >
            <CloseIcon size={12} />
          </Button>
        </motion.div>
      </div>
    </Reorder.Item>
  );
};

// 使用 React.memo 优化组件，避免不必要的重渲染
export default React.memo(TagItem);
