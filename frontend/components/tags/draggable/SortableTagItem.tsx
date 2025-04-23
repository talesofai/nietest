"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@heroui/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Icon } from "@iconify/react";

import { Tag } from "@/types/tag";
import {
  getTypeDisplayName,
  truncateText,
} from "@/components/tags/draggable/tagUtils";
import { UserIcon } from "@/components/tags/draggable";
import ColorButton from "@/components/ColorButton";

interface SortableTagItemProps {
  tag: Tag;
  onEdit: () => void;
  onRemove: () => void;
  onToggleVariable: () => void;
}

/**
 * 可排序标签项组件
 * 在标签列表中用于显示和拖拽排序的单个标签项
 */
const SortableTagItem: React.FC<SortableTagItemProps> = ({
  tag,
  onEdit,
  onRemove,
}) => {
  // 使用useRef来保持DOM元素的引用，用于测量宽度
  const elementRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | undefined>(undefined);

  // 使用 dnd-kit 的 useSortable hook
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: tag.id,
    data: {
      width: width,
      tag: tag,
    },
  });

  // 在组件挂载后和每次窗口尺寸变化时以及标签内容变化时测量元素宽度
  useEffect(() => {
    const updateWidth = () => {
      if (elementRef.current) {
        const rect = elementRef.current.getBoundingClientRect();

        setWidth(rect.width);
      }
    };

    // 初始时测量
    updateWidth();

    // 使用ResizeObserver监听元素大小变化，比window.resize更精确
    const resizeObserver = new ResizeObserver(updateWidth);

    if (elementRef.current) {
      resizeObserver.observe(elementRef.current);
    }

    // 监听窗口大小变化作为后备
    window.addEventListener("resize", updateWidth);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, [tag.value, tag.name, tag.type]); // 当标签内容或类型变化时重新测量

  // 应用拖拽时的样式，修改为拖拽时完全隐藏原元素
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1, // 拖拽时完全隐藏原元素
    zIndex: isDragging ? 10 : 1,
    // 只在拖拽时设置固定宽度，否则让元素自然调整尺寸
    ...(isDragging && width ? { width: `${width}px` } : {}),
  };

  // 根据标签类型和变量状态决定按钮样式
  const getButtonVariant = () => {
    if (tag.isVariable) {
      return "shadow";
    }
    if (tag.type === "prompt") {
      return "solid";
    }

    return "solid";
  };

  // 获取标签显示文本
  const getDisplayText = () => {
    let text = "";

    if (tag.isVariable) {
      text = `${tag.name || ""} [变量]`;
    } else if (tag.type === "prompt") {
      text = truncateText(tag.value);
    } else if (tag.type === "character") {
      text = truncateText(tag.value);
    } else {
      text = `${getTypeDisplayName(tag.type)}: ${truncateText(tag.value)}`;
    }

    // 如果有权重，显示权重信息
    if (
      (tag.type === "character" || tag.type === "element") &&
      tag.weight !== undefined
    ) {
      text += ` [权重: ${tag.weight}]`;
    }

    return text;
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      className={`inline-flex group relative ${isDragging ? "z-10" : "z-0"}`}
      data-tag-id={tag.id}
    >
      <div
        className={`transition-transform ${isDragging ? "scale-105" : ""}`}
        style={{ opacity: isDragging ? 0.3 : 1 }}
      >
        {tag.type === "character" || tag.type === "element" ? (
          <ColorButton
            className={`group-hover:scale-105 transition-transform cursor-move whitespace-nowrap ${isDragging ? "opacity-50" : ""}`}
            gradientToColor={tag.gradientToColor}
            hexColor={tag.color}
            startContent={
              tag.header_img && (
                <div className="h-5 w-5 flex-shrink-0 bg-transparent rounded-full overflow-hidden">
                  <img
                    alt=""
                    className="h-full w-full object-cover"
                    src={tag.header_img}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Crect width="40" height="40" fill="%23dddddd"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="12" fill="%23888888" text-anchor="middle" dominant-baseline="middle"%3E角色%3C/text%3E%3C/svg%3E';
                    }}
                  />
                </div>
              )
            }
            useGradient={tag.useGradient}
            variant={getButtonVariant()}
            onPress={!isDragging ? onEdit : undefined}
            {...listeners}
          >
            {getDisplayText()}
          </ColorButton>
        ) : (
          <ColorButton
            className="group-hover:scale-105 transition-transform cursor-move whitespace-nowrap"
            gradientToColor={tag.gradientToColor}
            hexColor={tag.color}
            startContent={
              tag.isVariable && tag.type.includes("character") ? (
                <div className="h-5 w-5 flex-shrink-0 text-foreground">
                  <UserIcon size={20} />
                </div>
              ) : null
            }
            useGradient={tag.useGradient}
            variant={getButtonVariant()}
            onPress={!isDragging ? onEdit : undefined}
            {...listeners}
          >
            {getDisplayText()}
          </ColorButton>
        )}

        <motion.div
          animate={{ scale: 1 }}
          className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          initial={{ scale: 0.5 }}
        >
          <Button
            isIconOnly
            className="rounded-full z-10"
            color="danger"
            size="sm"
            variant="shadow"
            onPress={() => onRemove()}
          >
            <Icon height={8} icon="solar:close-circle-linear" width={8} />
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default SortableTagItem;
