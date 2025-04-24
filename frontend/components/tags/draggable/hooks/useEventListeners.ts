import { useEffect } from "react";

import { VariableValue } from "@/types/variable";

/**
 * 角色和元素选择事件监听自定义 Hook
 * 处理角色和元素选择事件
 */
export const useEventListeners = (
  setVariableValues: React.Dispatch<React.SetStateAction<VariableValue[]>>
) => {
  useEffect(() => {
    // 处理角色选择事件
    const handleCharacterSelect = (event: CustomEvent) => {
      const { valueId, characterInfo } = event.detail;

      // 更新角色信息
      setVariableValues((prevValues) =>
        prevValues.map((val) => {
          if (val.variable_id === valueId || (val as any).id === valueId) {
            return {
              ...val,
              value: characterInfo.name,
              uuid: characterInfo.uuid,
              header_img: characterInfo.header_img,
            };
          }

          return val;
        })
      );
    };

    // 处理元素选择事件
    const handleElementSelect = (event: CustomEvent) => {
      const { valueId, elementInfo } = event.detail;

      // 更新元素信息
      setVariableValues((prevValues) =>
        prevValues.map((val) => {
          if (val.variable_id === valueId || (val as any).id === valueId) {
            return {
              ...val,
              value: elementInfo.name,
              uuid: elementInfo.uuid,
              header_img: elementInfo.header_img,
            };
          }

          return val;
        })
      );
    };

    // 添加事件监听
    document.addEventListener("character-selected", handleCharacterSelect as EventListener);
    document.addEventListener("element-selected", handleElementSelect as EventListener);

    // 组件卸载时移除监听

    return () => {
      document.removeEventListener("character-selected", handleCharacterSelect as EventListener);
      document.removeEventListener("element-selected", handleElementSelect as EventListener);
    };
  }, [setVariableValues]);
};
