"use client";

import React from "react";
import { CloseIcon } from "@/components/icons";
import { VTokenDisplayProps } from "@/types/vtoken";
import { getPlaceholderSvg } from "@/utils/vtokenService";

/**
 * 令牌显示组件
 * 显示角色或元素的基本信息，包括头像、名称等
 */
const VTokenDisplay: React.FC<VTokenDisplayProps> = ({
    name,
    onClose,
    onClick,
    header_img,
    type,
    customIcon,
    isDisabled = false
}) => {
    // 处理关闭按钮点击
    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation();
        onClose && onClose();
    };

    return (
        <div
            className={`flex items-center gap-2 p-2 border rounded-md bg-default-100 w-full ${onClick && !isDisabled ? 'cursor-pointer' : ''}`}
            onClick={onClick && !isDisabled ? onClick : undefined}
        >
            {/* 图标/头像部分 */}
            <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full flex items-center justify-center bg-gray-200">
                {header_img ? (
                    <img
                        src={header_img}
                        alt={name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = getPlaceholderSvg(type);
                        }}
                    />
                ) : customIcon ? (
                    customIcon
                ) : (
                    <span className="text-xs">{type === "character" ? "角" : "元"}</span>
                )}
            </div>

            {/* 名称部分 - 占据剩余空间并左对齐 */}
            <div className="flex-grow text-left truncate">
                {name}
            </div>

            {/* 关闭按钮 */}
            {onClose && !isDisabled && (
                <div
                    className="cursor-pointer flex-shrink-0"
                    onClick={handleClose}
                >
                    <CloseIcon size={14} />
                </div>
            )}
        </div>
    );
};

export default VTokenDisplay;