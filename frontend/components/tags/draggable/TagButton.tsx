"use client";

import React from "react";
import { Button } from "@heroui/react";

interface TagButtonProps {
    label: string;
    weight?: number;
    imageUrl?: string;
    onClick?: () => void;
    variant?: "solid" | "bordered" | "light" | "flat" | "faded" | "shadow";
    color?: "default" | "primary" | "secondary" | "success" | "warning" | "danger";
    size?: "sm" | "md" | "lg";
}

/**
 * 带有左侧圆形图像的标签按钮组件
 */
const TagButton: React.FC<TagButtonProps> = ({
    label,
    weight,
    imageUrl,
    onClick,
    variant = "solid",
    color = "default",
    size = "sm"
}) => {
    // 获取占位图SVG
    const getPlaceholderSvg = () => {
        return `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Crect width="40" height="40" fill="%23dddddd"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="12" fill="%23888888" text-anchor="middle" dominant-baseline="middle"%3E标%3C/text%3E%3C/svg%3E`;
    };

    // 处理图像加载错误
    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
        (e.target as HTMLImageElement).src = getPlaceholderSvg();
    };

    // 显示的文本，如果有权重则加上权重
    const displayText = weight !== undefined && weight !== 1
        ? `${label} [${weight}]`
        : label;

    return (
        <Button
            className="flex items-center gap-1 px-2 py-1 h-auto min-h-[32px] min-w-0 overflow-hidden"
            color={color}
            variant={variant}
            size={size}
            onClick={onClick}
        >
            {/* 圆形图像 */}
            {imageUrl && (
                <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 bg-gray-100">
                    <img
                        src={imageUrl}
                        alt={label}
                        className="w-full h-full object-cover"
                        onError={handleImageError}
                    />
                </div>
            )}

            {/* 标签文本，如果较长则截断 */}
            <span className="truncate max-w-[150px]" title={displayText}>
                {displayText}
            </span>
        </Button>
    );
};

export default TagButton;