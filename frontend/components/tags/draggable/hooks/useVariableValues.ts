import { alertService } from "@/utils/alertService";
import { Tag } from "@/types/tag";
import { VariableValue } from "@/types/variable";

import { getDefaultValueByType } from "../tagUtils";

/**
 * 变量值操作自定义 Hook
 * 管理变量值的添加、更新、删除和复制等操作
 */
export const useVariableValues = (
  setVariableValues: React.Dispatch<React.SetStateAction<VariableValue[]>>,
  tags: Tag[]
) => {
  // 处理变量值重新排序
  const handleReorderValues = (tagId: string, newValues: VariableValue[]) => {
    setVariableValues((prev) => {
      const otherValues = prev.filter((v) => v.tag_id !== tagId);

      return [...otherValues, ...newValues];
    });
  };

  // 添加变量值
  const addVariableValue = (tagId: string) => {
    const tag = tags.find((t) => t.id === tagId);

    if (!tag) return;

    // 从默认名称或标签类型生成变量值
    const newValue: VariableValue = {
      variable_id: Date.now().toString(),
      tag_id: tagId,
      value: getDefaultValueByType(tag.type),
      // 如果是角色或元素类型，添加相关信息
      ...(tag.type === "character" || tag.type === "element"
        ? {
            uuid: tag.uuid,
            header_img: tag.header_img,
          }
        : {}),
    };

    setVariableValues((prev) => [...prev, newValue]);
  };

  // 更新变量值
  const updateVariableValue = (
    id: string,
    value: string,
    characterInfo?: { uuid?: string; header_img?: string; weight?: number }
  ) => {
    // 这里的返回值未被使用，可以直接调用而不赋值
    setVariableValues((prev) => {
      const valueToUpdate = prev.find((v) => v.variable_id === id);

      if (valueToUpdate) {
        const tag = tags.find((t) => t.id === valueToUpdate.tag_id);

        if (tag?.type === "polish") {
          if (value !== "true" && value !== "false") {
            alertService.warning("变量值限制", "润色变量只能为true或false");

            return prev;
          }
        }

        return prev.map((v) => {
          if (v.variable_id === id) {
            // 返回更新后的变量值

            return {
              ...v,
              value,
              // 如果提供了角色信息，则更新
              ...(characterInfo?.uuid ? { uuid: characterInfo.uuid } : {}),
              ...(characterInfo?.header_img ? { header_img: characterInfo.header_img } : {}),
              ...(characterInfo?.weight ? { weight: characterInfo.weight } : {}),
            };
          }

          return v;
        });
      }

      return prev;
    });
  };

  // 删除变量值
  const removeVariableValue = (id: string) => {
    setVariableValues((prevValues) => prevValues.filter((value) => value.variable_id !== id));
  };

  // 复制变量值
  const duplicateVariableValue = (id: string) => {
    setVariableValues((prevValues) => {
      const valueToDuplicate = prevValues.find((v) => v.variable_id === id);

      if (!valueToDuplicate) return prevValues;

      // 创建新的变量值，复制原有的所有属性
      const newValue: VariableValue = {
        ...valueToDuplicate,
        variable_id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, // 生成新的ID
      };

      // 将新的变量值插入到原变量值之后
      const index = prevValues.findIndex((v) => v.variable_id === id);

      if (index === -1) return [...prevValues, newValue];

      const newValues = [...prevValues];

      newValues.splice(index + 1, 0, newValue);

      return newValues;
    });
  };

  return {
    handleReorderValues,
    addVariableValue,
    updateVariableValue,
    removeVariableValue,
    duplicateVariableValue,
  };
};
