"use client";

import React from "react";
import Image from "next/image";

import { CloseIcon } from "@/components/icons";
import { VTokenDisplayProps } from "@/types/vtoken";
import { getPlaceholderSvg } from "@/utils/vtokenService";

/**
 * 渲染令牌图标或头像
 */
const TokenIcon = ({
    header_img,
    type,
    customIcon,
    name,
}: {
    header_img?: string;
    type: string;
    customIcon?: React.ReactNode;
    name: string;
}) => {
    return (
        <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full flex items-center justify-center bg-gray-200">
            {header_img ? (
                <Image
                    alt={name}
                    className="h-full w-full object-cover"
                    height={28}
                    src={header_img}
                    width={28}
                    onError={(e) => {
                        const target = e.target as HTMLImageElement;

                        target.src = getPlaceholderSvg(type as "character" | "element");
                    }}
                />
            ) : customIcon ? (
                customIcon
            ) : (
                <span className="text-xs">{type === "character" ? "角" : "元"}</span>
            )}
        </div>
    );
};

/**
 * 渲染关闭按钮
 */
const CloseButton = ({ onClose, isDisabled }: { onClose?: () => void; isDisabled: boolean }) => {
    if (!onClose || isDisabled) return null;

    // 处理关闭按钮点击
    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation();
        onClose();
    };

    // 处理关闭按钮键盘事件
    const handleCloseKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClose();
        }
    };

    return (
        <div
            className="cursor-pointer flex-shrink-0"
            role="button"
            tabIndex={0}
            onClick={handleClose}
            onKeyDown={handleCloseKeyDown}
        >
            <CloseIcon size={14} />
        </div>
    );
};

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
    isDisabled = false,
}) => {
    // 处理键盘事件
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (onClick && !isDisabled) {
                onClick();
            }
        }
    };

    // 确定是否可点击
    const isClickable = onClick && !isDisabled;

    return (
        <div
            className={`flex items-center gap-2 p-2 border rounded-md bg-default-100 w-full ${isClickable ? "cursor-pointer" : ""}`}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onClick={isClickable ? onClick : undefined}
            onKeyDown={isClickable ? handleKeyDown : undefined}
        >
            {/* 图标/头像部分 */}
            <TokenIcon customIcon={customIcon} header_img={header_img} name={name} type={type} />

            {/* 名称部分 - 占据剩余空间并左对齐 */}
            <div className="flex-grow text-left truncate">{name}</div>

            {/* 关闭按钮 */}
            <CloseButton isDisabled={isDisabled} onClose={onClose} />
        </div>
    );
};

export default VTokenDisplay;
