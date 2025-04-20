"use client";

import React, { useState, useEffect, KeyboardEvent, useRef } from "react";
import { motion } from "framer-motion";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Slider } from "@heroui/react";
import { Input } from "@heroui/input";
import { Switch } from "@heroui/switch";
import { Tag } from "@/types/tag";
import { getTypeDisplayName, getDefaultValueByType, RESERVED_VARIABLE_NAMES, isVariableNameLengthValid } from "@/components/tags/draggable/tagUtils";
import { TagValueInput } from "../TagValueInput";
import { alertService } from "@/utils/alertService";

interface EditTagModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (editedTag: Tag) => void;
    tag: Tag | null;
    tags: Tag[];
}

/**
 * 编辑标签模态窗口组件
 */
const EditTagModal: React.FC<EditTagModalProps> = ({ isOpen, onClose, onSave, tag, tags }) => {
    const [editingTag, setEditingTag] = useState<Tag | null>(null);
    const variableNameInputRef = useRef<HTMLInputElement>(null);

    // 当标签改变时更新编辑状态
    useEffect(() => {
        if (tag) {
            // 确保角色、元素和提示词类型有默认权重值
            if ((tag.type === "character" || tag.type === "element" || tag.type === "prompt") && tag.weight === undefined) {
                setEditingTag({ ...tag, weight: 1 });
            } else {
                setEditingTag({ ...tag });
            }
        }
    }, [tag]);

    // 如果没有编辑中的标签，不渲染内容
    if (!editingTag) return null;

    // 处理变量模式切换
    const handleVariableToggle = (checked: boolean) => {
        if (checked && editingTag.type !== "prompt" && editingTag.type !== "character" && editingTag.type !== "element") {
            // 检查是否已存在同类型的变量
            if (tags.some(t => t.isVariable && t.type === editingTag.type && t.id !== editingTag.id)) {
                alertService.error("变量标签类型重复", `已经存在 ${getTypeDisplayName(editingTag.type)} 类型的变量标签`);
                return;
            }

            // 非prompt类型、非character类型和非element类型使用默认变量名
            const variableName = RESERVED_VARIABLE_NAMES[editingTag.type as keyof typeof RESERVED_VARIABLE_NAMES];

            setEditingTag({
                ...editingTag,
                isVariable: true,
                name: variableName
            });
        } else if (checked) {
            // Prompt类型、Character类型或Element类型需要用户输入变量名
            setEditingTag({
                ...editingTag,
                isVariable: true,
                name: ""
            });
        } else {
            // 切换为非变量
            setEditingTag({
                ...editingTag,
                isVariable: false,
                name: undefined
            });
        }
    };

    // 处理保存操作
    const handleSave = (onModalClose: () => void) => {
        // 验证变量名长度
        if (editingTag.isVariable && (editingTag.type === "prompt" || editingTag.type === "character" || editingTag.type === "element") && editingTag.name) {
            if (!isVariableNameLengthValid(editingTag.name.trim())) {
                alertService.error("变量名过长", "变量名不能超过12个字符");
                return;
            }
        }

        onSave(editingTag);
        onModalClose();
    };

    // 处理键盘事件，支持回车键提交
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, onModalClose: () => void) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSave(onModalClose);
        }
    };

    return (
        <Modal isOpen={isOpen} onOpenChange={onClose}>
            <ModalContent>
                {(onModalClose) => (
                    <>
                        <ModalHeader className="flex flex-col gap-1">
                            <span style={{ color: editingTag.color }}>
                                编辑标签
                            </span>
                        </ModalHeader>
                        <ModalBody>
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-4"
                            >
                                <div className="flex items-center space-x-2">
                                    <div className="font-semibold">标签类型:</div>
                                    <div>{getTypeDisplayName(editingTag.type)}</div>
                                </div>

                                {/* 变量切换开关 */}
                                {editingTag.type !== "batch" && (
                                    <div className="flex items-center space-x-2">
                                        <div className="font-semibold">变量模式:</div>
                                        <Switch
                                            size="sm"
                                            isSelected={editingTag.isVariable}
                                            onValueChange={handleVariableToggle}
                                        />
                                    </div>
                                )}

                                {/* 变量模式下显示变量名输入框 */}
                                {editingTag.isVariable && (
                                    <div>
                                        <span className="text-sm font-semibold mb-1 block">变量名:</span>
                                        <Input
                                            ref={variableNameInputRef}
                                            size="sm"
                                            placeholder="输入变量名称"
                                            value={editingTag.name || ''}
                                            isDisabled={editingTag.type !== "prompt" && editingTag.type !== "character" && editingTag.type !== "element"} // 非prompt类型、非character类型和非element类型变量名不可修改
                                            onChange={(e) => {
                                                setEditingTag({
                                                    ...editingTag,
                                                    name: e.target.value
                                                });
                                            }}
                                            onKeyDown={(e) => handleKeyDown(e, onModalClose)}
                                            className="w-full"
                                            autoFocus={editingTag.type === "prompt" || editingTag.type === "character" || editingTag.type === "element"}
                                        />
                                        {editingTag.type !== "prompt" && editingTag.type !== "character" && editingTag.type !== "element" && (
                                            <div className="text-xs text-gray-500 mt-1">
                                                系统预留变量名，不可修改
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 非变量模式下显示值输入框 */}
                                {!editingTag.isVariable && (
                                    <div>
                                        <span className="text-sm font-semibold mb-1 block">标签值:</span>
                                        <TagValueInput
                                            value={editingTag.value}
                                            type={editingTag.type}
                                            onChange={(newValue) => setEditingTag({ ...editingTag, value: newValue })}
                                            onEnterPress={() => handleSave(onModalClose)}
                                            autoFocus={true}
                                        />
                                    </div>
                                )}

                                {/* 权重输入框 - 仅对角色、元素和提示词类型显示，且不是变量时 */}
                                {(editingTag.type === "character" || editingTag.type === "element" || editingTag.type === "prompt") && !editingTag.isVariable && (
                                    <div>
                                        <span className="text-sm font-semibold mb-1 block">权重:</span>
                                        <Slider
                                            size="sm"
                                            label="权重"
                                            color="foreground"
                                            step={0.05}
                                            minValue={0.05}
                                            maxValue={2}
                                            defaultValue={1}
                                            value={editingTag.weight !== undefined ? editingTag.weight : 1}
                                            onChange={(val) => setEditingTag({ ...editingTag, weight: val as number })}
                                            className="w-full"
                                            showSteps={false}
                                            formatOptions={{ style: "decimal", minimumFractionDigits: 2, maximumFractionDigits: 2 }}
                                        />
                                    </div>
                                )}
                            </motion.div>
                        </ModalBody>
                        <ModalFooter>
                            <Button color="danger" variant="light" onPress={onModalClose}>
                                取消
                            </Button>
                            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                <Button
                                    color="primary"
                                    onPress={() => handleSave(onModalClose)}
                                >
                                    保存
                                </Button>
                            </motion.div>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
};

export default EditTagModal;