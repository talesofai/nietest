import { useState } from "react";
import { useDisclosure } from "@heroui/react";

import {
  getDefaultValueByType,
  RESERVED_VARIABLE_NAMES,
  getTypeDisplayName,
} from "../tagUtils";

import { alertService } from "@/utils/alertService";
import { Tag } from "@/types/tag";
import { VariableValue } from "@/types/variable";
import { getRandomGradientColors } from "@/config/colors";

/**
 * 标签编辑自定义 Hook
 * 管理标签的编辑、添加和切换变量状态等操作
 */
export const useTagEdit = (
  tags: Tag[],
  setTags: React.Dispatch<React.SetStateAction<Tag[]>>,
  variableValues: VariableValue[],
  setVariableValues: React.Dispatch<React.SetStateAction<VariableValue[]>>,
) => {
  // 标签编辑模态框状态
  const {
    isOpen: isEditingTagModalOpen,
    onOpen: onEditingTagModalOpen,
    onClose: onEditingTagModalClose,
  } = useDisclosure();

  // 编辑状态
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  // 开始编辑标签值
  const startEditTag = (tag: Tag) => {
    setEditingTag(tag);
    onEditingTagModalOpen();
  };

  // 保存编辑后的标签
  const saveEditTag = (updatedTag: Tag) => {
    setTags((prevTags) => {
      return prevTags.map((tag) =>
        tag.id === updatedTag.id ? updatedTag : tag,
      );
    });

    if (updatedTag.isVariable) {
      if (updatedTag.type === "polish") {
        // 对于润色类型，创建true和false两个变量值
        const trueValue: VariableValue = {
          variable_id: Date.now().toString() + "-true",
          tag_id: updatedTag.id,
          value: "true",
        };

        const falseValue: VariableValue = {
          variable_id: Date.now().toString() + "-false",
          tag_id: updatedTag.id,
          value: "false",
        };

        setVariableValues((prev) => [
          ...prev.filter((v) => v.tag_id !== updatedTag.id),
          trueValue,
          falseValue,
        ]);
      } else {
        // 对于其他类型，创建默认值
        const newValue: VariableValue = {
          variable_id: Date.now().toString(),
          tag_id: updatedTag.id,
          value: updatedTag.value || getDefaultValueByType(updatedTag.type),
          // 如果是角色或元素类型，添加相关信息
          ...(updatedTag.type === "character" || updatedTag.type === "element"
            ? {
                uuid: updatedTag.uuid,
                header_img: updatedTag.header_img,
              }
            : {}),
        };

        setVariableValues((prev) => [
          ...prev.filter((v) => v.tag_id !== updatedTag.id),
          newValue,
        ]);
      }
    }

    setEditingTag(null);
  };

  // 切换标签是否为变量
  const toggleTagVariable = (tag: Tag) => {
    if (tag.type === "batch") {
      alertService.warning(
        "类型限制",
        `${getTypeDisplayName(tag.type)}类型不能设为变量`,
      );

      return;
    }

    // 如果要切换为变量
    if (!tag.isVariable) {
      // 检查是否已存在同类型的变量
      if (
        tag.type !== "prompt" &&
        tag.type !== "character" &&
        tags.some((t) => t.isVariable && t.type === tag.type)
      ) {
        alertService.error(
          "变量标签类型重复",
          `已经存在 ${tag.type} 类型的变量标签`,
        );

        return;
      }

      // 打开编辑模态窗口，显示变量设置界面
      const editTag = {
        ...tag,
        isVariable: true,
        useGradient: true, // 确保变量标签使用渐变色
        gradientToColor: getRandomGradientColors().to, // 设置随机渐变色
      };

      // 为非prompt和非character类型设置默认变量名
      if (tag.type !== "prompt" && tag.type !== "character") {
        editTag.name =
          RESERVED_VARIABLE_NAMES[
            tag.type as keyof typeof RESERVED_VARIABLE_NAMES
          ];
      } else {
        // prompt类型和character类型需要在编辑界面输入变量名
        editTag.name = "";
      }

      setEditingTag(editTag);
      onEditingTagModalOpen();
    } else {
      // 从变量切换为非变量，打开编辑界面确认
      const editTag = {
        ...tag,
        isVariable: false,
        name: undefined,
        useGradient: false, // 非变量标签不使用渐变色
        gradientToColor: undefined, // 移除渐变色
      };

      setEditingTag(editTag);
      onEditingTagModalOpen();
    }
  };

  // 删除标签
  const removeTag = (id: string) => {
    setTags((prevTags) => prevTags.filter((tag) => tag.id !== id));
    setVariableValues((prevValues) =>
      prevValues.filter((value) => value.tag_id !== id),
    );
  };

  return {
    editingTag,
    isEditingTagModalOpen,
    onEditingTagModalClose,
    startEditTag,
    saveEditTag,
    toggleTagVariable,
    removeTag,
    setEditingTag,
  };
};
