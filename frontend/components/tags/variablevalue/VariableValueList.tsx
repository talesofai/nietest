"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

import ColorButton from "../../ColorButton";

import VariableValueInput from "./VariableValueInput";

import { Tag } from "@/types/tag";
import { VariableValue } from "@/types/variable";
import { getTypeDisplayName } from "@/components/tags/draggable/tagUtils";

interface VariableValueListProps {
  tags: Tag[];
  variableValues: VariableValue[];
  onAddValue: (tagId: string) => void;
  onUpdateValue: (
    id: string,
    value: string,
    characterInfo?: { uuid?: string; header_img?: string; weight?: number }
  ) => void;
  onRemoveValue: (id: string) => void;
  onDuplicateValue: (id: string) => void;
  onRemoveTag: (id: string) => void;
  onReorderValues?: (tagId: string, newValues: VariableValue[]) => void;
}

/**
 * 变量值列表组件
 */
const VariableValueList: React.FC<VariableValueListProps> = ({
  tags,
  variableValues,
  onAddValue,
  onUpdateValue,
  onRemoveValue,
  onDuplicateValue,
  onRemoveTag,
  onReorderValues = (_tagId, _newValues) => {},
}) => {
  // 过滤出变量标签
  const variableTags = tags.filter((tag) => tag.isVariable);

  if (variableTags.length === 0) {
    return null;
  }

  // 处理向上移动
  const handleMoveUp = (valueId: string) => {
    // 查找要移动的变量值
    const valueToMove = variableValues.find((v) => v.variable_id === valueId);

    if (!valueToMove) return;

    // 获取当前标签的所有变量值
    const tagValues = variableValues.filter((v) => v.tag_id === valueToMove.tag_id);

    // 计算当前索引
    const currentIndex = tagValues.findIndex((v) => v.variable_id === valueId);

    // 如果已经是第一个，则不能再向上移动
    if (currentIndex <= 0) return;

    // 创建新的排序数组，交换当前元素和上一个元素的位置
    const newOrder = [...tagValues];

    [newOrder[currentIndex], newOrder[currentIndex - 1]] = [
      newOrder[currentIndex - 1],
      newOrder[currentIndex],
    ];

    // 触发重新排序回调
    onReorderValues(valueToMove.tag_id, newOrder);
  };

  // 处理向下移动
  const handleMoveDown = (valueId: string) => {
    // 查找要移动的变量值
    const valueToMove = variableValues.find((v) => v.variable_id === valueId);

    if (!valueToMove) return;

    // 获取当前标签的所有变量值
    const tagValues = variableValues.filter((v) => v.tag_id === valueToMove.tag_id);

    // 计算当前索引
    const currentIndex = tagValues.findIndex((v) => v.variable_id === valueId);

    // 如果已经是最后一个，则不能再向下移动
    if (currentIndex >= tagValues.length - 1) return;

    // 创建新的排序数组，交换当前元素和下一个元素的位置
    const newOrder = [...tagValues];

    [newOrder[currentIndex], newOrder[currentIndex + 1]] = [
      newOrder[currentIndex + 1],
      newOrder[currentIndex],
    ];

    // 触发重新排序回调
    onReorderValues(valueToMove.tag_id, newOrder);
  };

  // 处理删除变量值
  const handleRemoveValue = (valueId: string) => {
    // 查找要删除的变量值
    const valueToRemove = variableValues.find((v) => v.variable_id === valueId);

    if (!valueToRemove) return;

    // 计算删除后该标签还剩多少变量值
    const remainingValues = variableValues.filter(
      (v) => v.tag_id === valueToRemove.tag_id && v.variable_id !== valueId
    );

    // 如果删除后没有任何变量值，则删除整个标签
    if (remainingValues.length === 0) {
      onRemoveTag(valueToRemove.tag_id);
    } else {
      // 否则只删除变量值
      onRemoveValue(valueId);
    }
  };

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 p-4 border rounded-lg bg-background/90 shadow-sm dark:border-default-200"
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
    >
      <h3 className="text-lg font-medium mb-4">变量值</h3>
      <div className="space-y-6">
        {variableTags.map((tag) => {
          // 获取当前标签的所有变量值
          const tagValues = variableValues.filter((value) => value.tag_id === tag.id);

          return (
            <motion.div
              key={`var-${tag.id}`}
              animate={{ opacity: 1, x: 0 }}
              className="border-b pb-4 dark:border-default-200"
              initial={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <ColorButton
                    className="mr-2"
                    gradientToColor={tag.gradientToColor}
                    hexColor={tag.color}
                    size="sm"
                    useGradient={tag.useGradient}
                    variant="shadow"
                  >
                    {tag.name || ""}
                  </ColorButton>
                  <span className="text-xs text-default-500">({getTypeDisplayName(tag.type)})</span>
                </div>
                <Button
                  isIconOnly
                  className="rounded-full w-6 h-6 min-w-0"
                  color="danger"
                  size="sm"
                  variant="light"
                  onPress={() => onRemoveTag(tag.id)}
                >
                  <Icon height={14} icon="solar:close-circle-linear" width={14} />
                </Button>
              </div>

              {/* 变量值列表 - 使用上下箭头控制排序 */}
              <div className="space-y-2 ml-2">
                <AnimatePresence>
                  {tagValues.map((value, index) => (
                    <motion.div
                      key={value.variable_id}
                      layout
                      animate={{ opacity: 1, y: 0 }}
                      className="relative"
                      exit={{ opacity: 0, y: -10 }}
                      initial={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="flex items-center gap-2 p-2 border rounded-md bg-default-50 hover:bg-default-100 dark:border-default-200 transition-colors">
                        {/* 内容区域 */}
                        <div className="flex-grow flex items-center">
                          <VariableValueInput
                            tag={tag}
                            value={value}
                            onChange={(newValue) => onUpdateValue(value.variable_id, newValue)}
                            onWeightChange={(weight) => {
                              if (
                                tag.type === "character" ||
                                tag.type === "element" ||
                                tag.type === "prompt"
                              ) {
                                onUpdateValue(value.variable_id, value.value, {
                                  weight,
                                });
                              }
                            }}
                          />
                        </div>

                        {/* 操作按钮放在右侧 */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* 只有当标签类型不是polish且有多个值时才显示上下箭头按钮 */}
                          {tag.type !== "polish" && tagValues.length > 1 && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                isIconOnly
                                className="min-w-0 w-6 h-6"
                                color="default"
                                isDisabled={index === 0}
                                size="sm"
                                title="上移"
                                variant="light"
                                onPress={() => handleMoveUp(value.variable_id)}
                              >
                                <Icon height={14} icon="solar:arrow-up-linear" width={14} />
                              </Button>
                              <Button
                                isIconOnly
                                className="min-w-0 w-6 h-6"
                                color="default"
                                isDisabled={index === tagValues.length - 1}
                                size="sm"
                                title="下移"
                                variant="light"
                                onPress={() => handleMoveDown(value.variable_id)}
                              >
                                <Icon height={14} icon="solar:arrow-down-linear" width={14} />
                              </Button>
                            </div>
                          )}

                          {/* 只有在非润色测试类型或者变量值数量大于最小要求时才显示删除按钮 */}
                          {(tag.type !== "polish" || tagValues.length > 2) && (
                            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                              <Button
                                isIconOnly
                                className="min-w-0 w-6 h-6"
                                color="danger"
                                size="sm"
                                title="删除"
                                variant="light"
                                onPress={() => handleRemoveValue(value.variable_id)}
                              >
                                <Icon height={14} icon="solar:close-circle-linear" width={14} />
                              </Button>
                            </motion.div>
                          )}
                          {/* 复制按钮 */}
                          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                            <Button
                              isIconOnly
                              className="min-w-0 w-6 h-6"
                              color="secondary"
                              size="sm"
                              title="复制该值"
                              variant="light"
                              onPress={() => onDuplicateValue(value.variable_id)}
                            >
                              <Icon height={14} icon="solar:copy-linear" width={14} />
                            </Button>
                          </motion.div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* 添加新值按钮 */}
                <div className="mt-2">
                  <Button
                    color="primary"
                    size="sm"
                    variant="flat"
                    onPress={() => onAddValue(tag.id)}
                  >
                    添加新值
                  </Button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default VariableValueList;
