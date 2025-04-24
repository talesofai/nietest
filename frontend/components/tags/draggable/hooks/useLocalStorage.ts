import { useState, useEffect } from "react";

import { Tag } from "@/types/tag";
import { VariableValue } from "@/types/variable";

import { STORAGE_KEYS } from "../constants";
import { validateTags, validateVariableValues } from "../validators";

/**
 * 本地存储设置类型
 */
interface GlobalSettings {
  maxThreads: number;
  xToken: string;
}

/**
 * 本地存储数据类型
 */
interface StorageData {
  tags: Tag[];
  variableValues: VariableValue[];
  globalSettings: GlobalSettings;
  isDataLoaded: boolean;
}

/**
 * 本地存储自定义 Hook
 * 管理标签、变量值和全局设置的本地存储
 */
export const useLocalStorage = (): StorageData & {
  setTags: React.Dispatch<React.SetStateAction<Tag[]>>;
  setVariableValues: React.Dispatch<React.SetStateAction<VariableValue[]>>;
  setGlobalSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
} => {
  // 状态初始化为空数组，避免水合错误
  const [tags, setTags] = useState<Tag[]>([]);
  const [variableValues, setVariableValues] = useState<VariableValue[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    maxThreads: 4,
    xToken: "",
  });

  // 客户端数据加载完成标记
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // 在客户端加载时从localStorage初始化数据
  useEffect(() => {
    const loadFromStorage = () => {
      try {
        // 加载标签数据
        const storedTagsJson = localStorage.getItem(STORAGE_KEYS.TAGS);
        const storedTags = storedTagsJson ? JSON.parse(storedTagsJson) : [];
        const validTags = validateTags(storedTags);

        // 加载变量值数据
        const storedValuesJson = localStorage.getItem(STORAGE_KEYS.VARIABLE_VALUES);
        const storedValues = storedValuesJson ? JSON.parse(storedValuesJson) : [];
        const validValues = validateVariableValues(storedValues, validTags);

        // 加载全局设置
        const storedSettingsJson = localStorage.getItem(STORAGE_KEYS.GLOBAL_SETTINGS);
        const storedSettings = storedSettingsJson
          ? JSON.parse(storedSettingsJson)
          : { maxThreads: 4, xToken: "" };

        // 更新状态
        setTags(validTags);
        setVariableValues(validValues);
        setGlobalSettings(storedSettings);
        setIsDataLoaded(true);
      } catch (error) {
        // eslint-disable-next-line no-console
        // eslint-disable-next-line no-console
        // eslint-disable-next-line no-console
        console.error("Error loading data from localStorage:", error);
        setIsDataLoaded(true);
      }
    };

    loadFromStorage();
  }, []);

  // 数据变更时保存到本地存储 - 只在数据加载完成后执行
  useEffect(() => {
    if (!isDataLoaded) return;

    try {
      localStorage.setItem(STORAGE_KEYS.TAGS, JSON.stringify(tags));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Error saving tags to localStorage:`, error);
    }
  }, [tags, isDataLoaded]);

  useEffect(() => {
    if (!isDataLoaded) return;

    try {
      localStorage.setItem(STORAGE_KEYS.VARIABLE_VALUES, JSON.stringify(variableValues));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Error saving variable values to localStorage:`, error);
    }
  }, [variableValues, isDataLoaded]);

  useEffect(() => {
    if (!isDataLoaded) return;

    try {
      localStorage.setItem(STORAGE_KEYS.GLOBAL_SETTINGS, JSON.stringify(globalSettings));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Error saving global settings to localStorage:`, error);
    }
  }, [globalSettings, isDataLoaded]);

  return {
    tags,
    setTags,
    variableValues,
    setVariableValues,
    globalSettings,
    setGlobalSettings,
    isDataLoaded,
  };
};
