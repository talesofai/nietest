"use client";

import React, { useState, useEffect, KeyboardEvent, useRef, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Button, Select, SelectItem, Input, Switch, Alert, Slider } from "@heroui/react";
import { Icon } from "@iconify/react";
import { CloseIcon } from "@heroui/shared-icons";

import { TagType, Tag } from "@/types/tag";
import {
  getDefaultValueByType,
  RESERVED_VARIABLE_NAMES,
  isVariableNameLengthValid,
  TAG_TYPE_OPTIONS,
} from "@/components/tags/draggable/tagUtils";
import { TagValueInput } from "@/components/tags/draggable/TagValueInput";
import { SearchSelectItem } from "@/types/search";

interface AddTagFormProps {
  onAdd: (data: {
    name: string;
    type: TagType;
    isVariable: boolean;
    value: string;
    uuid?: string;
    avatar?: string;
    heat_score?: number;
    weight?: number;
    header_img?: string;
  }) => void;
  onCancel: () => void;
  tags?: Tag[]; // 当前已有的标签列表，用于检查是否存在lumina1元素
}

/**
 * 添加标签表单组件
 */
const AddTagForm: React.FC<AddTagFormProps> = ({ onAdd, onCancel, tags = [] }) => {
  const [name, setName] = useState("");
  const [type, setType] = useState<TagType>("prompt");
  const [isVariable, setIsVariable] = useState(false);
  const [value, setValue] = useState("");
  const [weight, setWeight] = useState<number>(1); // 默认权重为1
  const [formError, setFormError] = useState<string | null>(null);
  const variableNameInputRef = useRef<HTMLInputElement>(null);

  // 检查是否存在lumina1元素
  const hasLumina1 = useMemo(() => {
    return tags.some(tag =>
      tag.type === "lumina" &&
      tag.value === "lumina1" &&
      !tag.isVariable
    );
  }, [tags]);

  // 根据是否存在lumina1元素过滤标签类型选项
  const filteredTagTypeOptions = useMemo(() => {
    return TAG_TYPE_OPTIONS.filter(option => {
      // 如果是ckpt_name、steps或cfg类型，只有在存在lumina1元素时才显示
      if (option.key === "ckpt_name" || option.key === "steps" || option.key === "cfg") {
        return hasLumina1;
      }
      return true;
    });
  }, [hasLumina1]);

  // 角色信息
  const [characterInfo, setCharacterInfo] = useState<{
    uuid?: string;
    avatar_img?: string;
    heat_score?: number;
  }>({});

  // 当类型改变时，重置值为该类型的默认值
  useEffect(() => {
    setValue(getDefaultValueByType(type));

    // 如果类型更改，重置角色信息和表单错误
    if (type !== "character") {
      setCharacterInfo({});
    }

    // 非角色、元素和提示词类型无需权重
    if (type !== "character" && type !== "element" && type !== "prompt") {
      setWeight(1);
    }

    setFormError(null);
  }, [type]);

  // 当类型或变量状态改变时，处理变量名
  useEffect(() => {
    // 如果选择了非prompt类型，且是变量，设置默认变量名
    if (
      type !== "prompt" &&
      type !== "batch" &&
      type !== "character" &&
      type !== "element" &&
      isVariable
    ) {
      setName(RESERVED_VARIABLE_NAMES[type as keyof typeof RESERVED_VARIABLE_NAMES]);
    }
  }, [type, isVariable]);

  // 处理变量模式切换
  const handleVariableToggle = useCallback(
    (checked: boolean) => {
      setIsVariable(checked);
      // 如果选择变量且不是prompt、character或element类型，设置默认变量名
      if (
        checked &&
        type !== "prompt" &&
        type !== "batch" &&
        type !== "character" &&
        type !== "element"
      ) {
        setName(RESERVED_VARIABLE_NAMES[type as keyof typeof RESERVED_VARIABLE_NAMES]);
      } else {
        setName("");
      }
      setFormError(null);
    },
    [type]
  );

  // 处理角色选择
  const handleCharacterSelect = useCallback((character: SearchSelectItem) => {
    setValue(character.name);
    setCharacterInfo({
      uuid: character.uuid,
      avatar_img: character.header_img,
      heat_score: character.heat_score,
    });
    setFormError(null);
  }, []);

  // 处理元素选择
  const handleElementSelect = useCallback((element: SearchSelectItem) => {
    setValue(element.name);
    setCharacterInfo({
      uuid: element.uuid,
      avatar_img: element.header_img,
      heat_score: element.heat_score,
    });
    setFormError(null);
  }, []);

  // 处理Lumina选择
  const handleLuminaSelect = useCallback((lumina: SearchSelectItem) => {
    setValue(lumina.name);
    // 保存完整的Lumina信息
    setCharacterInfo({
      uuid: lumina.uuid,
      avatar_img: lumina.header_img,
      header_img: lumina.header_img,
      heat_score: lumina.heat_score,
      // 保存其他必要的字段
      ref_uuid: (lumina as any).ref_uuid || "",
      short_name: (lumina as any).short_name || lumina.name,
      status: (lumina as any).status || "PUBLISHED",
      accessibility: (lumina as any).accessibility || "PUBLIC",
      platform: (lumina as any).platform || "nieta-app",
      config: lumina.config || {
        header_img: lumina.header_img,
        avatar_img: lumina.header_img,
      },
    });
    setFormError(null);
  }, []);

  // 名称验证
  const nameError = useMemo(() => {
    if (isVariable && name.trim() && !isVariableNameLengthValid(name.trim())) {
      return "变量名不能超过12个字符";
    }

    return null;
  }, [name, isVariable]);

  // 处理提交
  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      // 阻止表单默认提交行为
      if (e) e.preventDefault();

      // 清除之前的错误
      setFormError(null);

      // 验证变量名长度
      if (nameError) {
        setFormError(nameError);
        variableNameInputRef.current?.focus();

        return;
      }

      // 如果是角色、元素或Lumina类型但不是变量且没有选择角色/元素/Lumina
      if ((type === "character" || type === "element" || type === "lumina") && !isVariable && !characterInfo.uuid) {
        let typeText = "元素";
        if (type === "character") typeText = "角色";
        else if (type === "lumina") typeText = "Lumina";

        setFormError(`请选择一个${typeText}`);

        return;
      }

      onAdd({
        name,
        type,
        isVariable,
        value: value || getDefaultValueByType(type),
        // 如果是角色、元素或Lumina类型，添加相关属性
        ...((type === "character" || type === "element" || type === "lumina") && !isVariable
          ? {
            uuid: characterInfo.uuid,
            header_img: characterInfo.header_img || characterInfo.avatar_img,
            heat_score: characterInfo.heat_score,
            color: "#cccccc", // 默认颜色
            useGradient: false, // 默认不使用渐变
          }
          : {}),
        // 如果是角色、元素、Lumina或提示词类型，添加权重
        ...((type === "character" || type === "element" || type === "lumina" || type === "prompt") &&
          !isVariable &&
          weight !== undefined
          ? { weight }
          : {}),
      });
    },
    [name, type, isVariable, value, characterInfo, weight, nameError, onAdd]
  );

  // 处理键盘事件，支持回车键提交
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <motion.form
      animate={{ scale: 1, opacity: 1 }}
      className="flex flex-col gap-3 p-3 border rounded-lg bg-white shadow-md w-80"
      exit={{ scale: 0.8, opacity: 0 }}
      initial={{ scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.2 }}
      onSubmit={(e) => handleSubmit(e)}
    >
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">添加标签窗口</h3>
        <Button isIconOnly className="rounded-full" size="sm" variant="light" onPress={onCancel}>
          <CloseIcon height={12} width={12} />
        </Button>
      </div>

      <div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center flex-1">
            <span className="text-sm font-semibold mr-2 min-w-[40px]">类型</span>
            <Select
              aria-label="类型"
              className="flex-1 min-w-[140px]"
              defaultSelectedKeys={["prompt"]}
              disallowEmptySelection={true}
              selectedKeys={[type]}
              selectionMode="single"
              size="sm"
              variant="flat"
              scrollShadowProps={{
                isEnabled: false
              }}
              popoverProps={{
                classNames: {
                  content: "min-w-[140px]"
                },
                placement: "bottom",
                offset: 5,
                showArrow: true
              }}
              listboxProps={{
                itemClasses: {
                  base: "text-sm"
                },
                style: {
                  maxHeight: "none"
                }
              }}
              maxListboxHeight={1000}
              onSelectionChange={(keys) => {
                const keysArray = Array.from(keys);

                if (keysArray.length > 0) {
                  const selectedKey = keysArray[0] as TagType;

                  setType(selectedKey);
                }
              }}
            >
              {filteredTagTypeOptions.map((option) => (
                <SelectItem key={option.key}>{option.label}</SelectItem>
              ))}
            </Select>
          </div>
          <div className="flex items-center whitespace-nowrap">
            <span className="text-sm font-semibold mr-2">变量</span>
            <Switch
              aria-label="变量模式"
              isDisabled={type === "batch"}
              isSelected={isVariable}
              size="sm"
              onValueChange={handleVariableToggle}
            />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-sm font-semibold mb-1">
            {isVariable ? "变量名" : type === "character" ? "角色选择" : "标签值"}
          </div>
          <div className="p-0.5">
            {isVariable ? (
              type === "prompt" || type === "character" || type === "element" ? (
                <Input
                  ref={variableNameInputRef}
                  // autoFocus={true} // 移除 autoFocus 以解决可访问性问题
                  className="w-full"
                  errorMessage={nameError}
                  isInvalid={!!nameError}
                  placeholder="输入变量名称"
                  size="sm"
                  value={name}
                  variant="flat"
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              ) : (
                <Input className="w-full" isDisabled={true} size="sm" value={name} variant="flat" />
              )
            ) : (
              <TagValueInput
                // autoFocus={true} // 移除 autoFocus 以解决可访问性问题
                type={type}
                value={value || getDefaultValueByType(type)}
                onChange={setValue}
                onEnterPress={handleSubmit}
                onSelectCharacter={handleCharacterSelect}
                onSelectElement={handleElementSelect}
                onSelectLumina={handleLuminaSelect}
              />
            )}
          </div>
        </div>

        {(type === "character" || type === "element" || type === "prompt") && !isVariable && (
          <div className="mt-3">
            <div className="text-sm font-semibold mb-1">权重</div>
            <div className="p-0.5">
              <Slider
                className="w-full"
                color="foreground"
                defaultValue={1}
                formatOptions={{
                  style: "decimal",
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }}
                label="权重"
                maxValue={2}
                minValue={0.05}
                showSteps={false}
                size="sm"
                step={0.05}
                value={weight}
                onChange={(val) => setWeight(val as number)}
              />
            </div>
          </div>
        )}

        {formError && !nameError && (
          <div className="mt-2">
            <Alert color="danger" title={formError} />
          </div>
        )}
      </div>

      <div className="flex justify-between mt-2">
        <Button
          color="danger"
          startContent={<Icon icon="solar:close-circle-linear" />}
          variant="light"
          onPress={onCancel}
        >
          取消
        </Button>
        <Button
          color="primary"
          isDisabled={isVariable && !name}
          startContent={<Icon icon="solar:check-circle-linear" />}
          type="button"
          onPress={() => handleSubmit()}
        >
          添加
        </Button>
      </div>
    </motion.form>
  );
};

export default AddTagForm;
