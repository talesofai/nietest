import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Select,
  SelectItem,
  Image,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Spinner,
  Slider,
} from "@heroui/react";
import { Icon } from "@iconify/react";

import { TaskDetail } from "@/types/task";
import { apiService } from "@/utils/api/apiService";
import { formatBeijingTime } from "@/utils/dateUtils";
import * as logger from "@/utils/logger";

// 占位图片URL
const PLACEHOLDER_IMAGE_URL = "/placeholder-image.png";

// 获取调整尺寸后的图片URL
const getResizedImageUrl = (url: string, size: number): string => {
  if (!url) return url;

  // 检查URL是否已经包含OSS处理参数
  if (url.includes("x-oss-process=")) {
    return url; // 已经有处理参数，不再添加
  }

  // 添加OSS处理参数
  const separator = url.includes("?") ? "&" : "?";

  return `${url}${separator}x-oss-process=image/resize,l_${size}/quality,q_80/format,webp`;
};

interface TaskDetailViewProps {
  task: TaskDetail;
}

interface TableCellData {
  url: string;
  urls?: string[]; // 所有匹配的URL，用于显示同一参数组合下的多个batch图片
  xValue: string;
  yValue: string;
  coordinates: Record<string, number>;
  hasValidImage: boolean;
}

interface TableRowData {
  key: string;
  rowTitle: string;
  [columnKey: string]: TableCellData | string;
}

// 矩阵数据接口
interface MatrixDataVariableValue {
  id: string;
  value: string;
  type?: string;
}

interface MatrixDataVariable {
  name: string;
  values: MatrixDataVariableValue[];
  values_count: number;
  tag_id?: string;
}

interface MatrixData {
  task_id: string;
  task_name: string;
  created_at: string;
  variables?: Record<string, MatrixDataVariable>;
  coordinates_by_indices?: Record<string, string>; // 键："0,1,,," -> URL映射
}

// 定义筛选维度的值类型
interface DimensionFilter {
  dimension: string; // 维度名称，如 "v0", "v1" 等
  valueIndex: number | null; // 选择的值索引，null 表示不筛选
}

export const TaskDetailView: React.FC<TaskDetailViewProps> = ({ task }) => {
  const [xAxis, setXAxis] = useState<string | null>(null);
  const [yAxis, setYAxis] = useState<string | null>(null);
  const [availableVariables, setAvailableVariables] = useState<string[]>([]);
  const [variableNames, setVariableNames] = useState<Record<string, string>>({});
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  // 使用useRef代替useState来存储DOM元素，避免无限循环
  const fullscreenElementRef = useRef<HTMLDivElement | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false);
  const [currentImageUrl, setCurrentImageUrl] = useState<string>("");
  const [currentImageTitle, setCurrentImageTitle] = useState<string>("");
  const [currentImageUrls, setCurrentImageUrls] = useState<string[]>([]);
  const [isGridView, setIsGridView] = useState<boolean>(false);
  const [hasBatchTag, setHasBatchTag] = useState<boolean>(false);

  // 新增：非X/Y轴维度的筛选值
  const [dimensionFilters, setDimensionFilters] = useState<DimensionFilter[]>([]);
  // 新增：可筛选的维度（非X/Y轴的维度）
  const [filterableDimensions, setFilterableDimensions] = useState<string[]>([]);

  // 矩阵数据 - 从后端获取的六维空间坐标系统
  const [matrixData, setMatrixData] = useState<MatrixData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 使用useRef跟踪数据是否已加载，避免重复请求
  const dataLoadedRef = useRef<boolean>(false);
  const taskIdRef = useRef<string | null>(null);
  const isMountedRef = useRef<boolean>(true);
  // 使用ref来跟踪URL验证是否已完成
  const urlValidationDoneRef = useRef<boolean>(false);
  // 使用ref来跟踪x轴和y轴的选择，避免依赖状态变量
  const xAxisRef = useRef<string | null>(null);
  const yAxisRef = useRef<string | null>(null);

  // 表格缩放控制
  const [tableScale, setTableScale] = useState<number>(100);

  // 查看单张图片函数（在当前页面显示模态框）
  const viewImageInModal = (imageUrl: string, title: string = "") => {
    setCurrentImageUrl(imageUrl);
    setCurrentImageTitle(title);
    setCurrentImageUrls([imageUrl]);
    setIsGridView(false);
    setIsImageModalOpen(true);
  };

  // 查看多张图片函数（用于批次任务）
  const viewMultipleImagesInModal = (urls: string[], title: string = "") => {
    if (!hasBatchTag || urls.length <= 1) {
      // 如果不是批次任务或只有一张图片，则只显示第一张图片
      viewImageInModal(urls[0], title);

      return;
    }

    setCurrentImageUrl(urls[0]);
    setCurrentImageTitle(title);
    setCurrentImageUrls(urls);
    setIsGridView(false);
    setIsImageModalOpen(true);
  };

  // 获取图片的多维坐标信息
  const getCoordinateInfo = (imageUrl: string): string => {
    if (!matrixData || !imageUrl) {
      return "无坐标信息";
    }

    // 查找图片在坐标映射中的数据
    if (!matrixData.coordinates_by_indices) {
      return "无坐标信息";
    }

    const indexedCoordKey = Object.entries(matrixData.coordinates_by_indices).find(
      ([_, url]) => url === imageUrl
    )?.[0];

    if (!indexedCoordKey) {
      return "无坐标信息";
    }

    // 将坐标字符串分解为数组，例如 "0,1,,2,," => ["0", "1", "", "2", "", ""]
    const coordIndices = indexedCoordKey.split(",");

    // 构建坐标信息
    const coordInfo = coordIndices
      .map((indexStr, dimension) => {
        if (indexStr === "") return null; // 跳过空坐标

        const varKey = `v${dimension}`;
        const varName = variableNames[varKey] || varKey;

        // 尝试获取该维度的实际值
        const varDefinition = matrixData.variables && matrixData.variables[varKey];
        let displayValue = indexStr; // 默认显示索引

        if (
          varDefinition &&
          varDefinition.values &&
          Array.isArray(varDefinition.values)
        ) {
          const idx = parseInt(indexStr);
          if (!isNaN(idx) && idx >= 0 && idx < varDefinition.values.length) {
            displayValue = `${varDefinition.values[idx].value} (索引 ${indexStr})`;
          }
        }

        return `${varKey}(${varName}): ${displayValue}`;
      })
      .filter(Boolean) // 过滤掉null值
      .join(", ");

    return coordInfo || "无坐标信息";
  };

  // 根据图片数量确定网格列数
  const getGridColumns = (imageCount: number): string => {
    if (imageCount <= 1) return "grid-cols-1";
    if (imageCount <= 4) return "grid-cols-2";
    if (imageCount <= 9) return "grid-cols-3";
    if (imageCount <= 16) return "grid-cols-4";

    return "grid-cols-5"; // 如果超过16张，使用5列
  };

  // 根据批次图片数量确定图片尺寸
  const getImageSizeByBatchCount = (imageCount: number): number => {
    if (imageCount <= 1) return 720; // 调整为更合适的尺寸
    if (imageCount <= 4) return 360; // 调整为更合适的尺寸
    if (imageCount <= 9) return 240; // 调整为更合适的尺寸
    if (imageCount <= 16) return 180; // 调整为更合适的尺寸

    return 120; // 如果超过16张，使用更小的尺寸
  };

  // 使用ref来跟踪请求状态
  const isRequestPendingRef = useRef<boolean>(false);

  // 从后端获取矩阵数据 - 只在组件挂载和taskId变化时调用一次
  const fetchMatrixData = useCallback(async (taskId: string, forceRefresh = false) => {
    // 如果组件已卸载或没有任务ID，则不执行
    if (!isMountedRef.current || !taskId) return;

    // 如果已经有请求在进行中，则不再发起新请求
    if (isRequestPendingRef.current) {
      logger.log(`已有请求正在进行，跳过新请求: ${taskId}`);

      return;
    }

    // 如果已经加载过该ID的数据且不是强制刷新，则不再重复请求
    if (!forceRefresh && dataLoadedRef.current && taskIdRef.current === taskId) {
      logger.log(`数据已加载，跳过请求: ${taskId}`);

      return;
    }

    // 标记请求开始
    isRequestPendingRef.current = true;
    logger.log(`开始请求矩阵数据: ${taskId}, 强制刷新: ${forceRefresh}`);

    setIsLoading(true);
    setError(null);

    try {
      // 更新当前任务ID引用
      taskIdRef.current = taskId;

      // 调用后端API获取矩阵数据 - 使用缓存机制
      const cacheKey = `matrix_${taskId}`;
      let response;

      // 尝试从sessionStorage获取缓存数据
      const cachedData = typeof window !== "undefined" ? sessionStorage.getItem(cacheKey) : null;

      if (!forceRefresh && cachedData) {
        try {
          response = { success: true, data: JSON.parse(cachedData) };
          if (process.env.NODE_ENV === "development") {
            // eslint-disable-next-line no-console
            console.log(`使用缓存的矩阵数据: ${taskId}`);
          }
        } catch {
          // 如果解析缓存数据失败，则从API获取
          response = await apiService.task.getTaskMatrix(taskId);
        }
      } else {
        // 从API获取数据
        response = await apiService.task.getTaskMatrix(taskId);

        // 缓存数据到sessionStorage
        if (response.success && response.data && typeof window !== "undefined") {
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(response.data));
          } catch (error) {
            logger.error("缓存矩阵数据失败:", error);
          }
        }
      }

      // 如果组件已卸载，不再继续处理
      if (!isMountedRef.current) return;

      if (response.error || !response.data) {
        throw new Error(response.error || "获取矩阵数据失败");
      }

      logger.log(`成功获取矩阵数据: ${taskId}`);

      // 设置矩阵数据，确保处理数据缺失的情况
      const processedData: MatrixData = {
        task_id: response.data.task_id || taskId,
        task_name: response.data.task_name || "",
        created_at: response.data.created_at || new Date().toISOString(),
        variables: response.data.variables || {},
        coordinates_by_indices: response.data.coordinates_by_indices || {}
      };

      // 记录处理后的数据
      logger.log(`处理后的矩阵数据:`, processedData);

      setMatrixData(processedData);

      // 标记数据已加载
      dataLoadedRef.current = true;

      // 提取变量名称和可用变量
      const variables: string[] = [];
      const varNames: Record<string, string> = {};

      if (processedData.variables) {
        Object.entries(processedData.variables).forEach(([key, value]) => {
          // 只添加name不为空的变量
          if (
            key.startsWith("v") &&
            value &&
            typeof value === "object" &&
            "name" in value &&
            value.name !== ""
          ) {
            varNames[key] = (value.name as string) || key;
            // 将变量添加到可用变量列表
            if (!variables.includes(key)) {
              variables.push(key);
            }
          }
        });
      }

      // 如果组件已卸载，不再更新状态
      if (!isMountedRef.current) return;

      // 批量更新状态，减少重新渲染次数
      const batchUpdate = () => {
        setVariableNames(varNames);
        setAvailableVariables(variables);

        // 只在初始加载时设置默认轴，避免覆盖用户选择
        // 注意：这里不依赖xAxis和yAxis的当前值，而是使用局部变量currentXAxis和currentYAxis
        const currentXAxis = xAxisRef.current;
        const currentYAxis = yAxisRef.current;
        const shouldSetDefaultAxes = (!currentXAxis && !currentYAxis) || forceRefresh;

        if (shouldSetDefaultAxes) {
          if (variables.length >= 2) {
            setXAxis(variables[0]);
            setYAxis(variables[1]);
            // 同时更新ref值
            xAxisRef.current = variables[0];
            yAxisRef.current = variables[1];
          } else if (variables.length === 1) {
            setXAxis(variables[0]);
            setYAxis("");
            // 同时更新ref值
            xAxisRef.current = variables[0];
            yAxisRef.current = "";
          } else {
            setXAxis("");
            setYAxis("");
            // 同时更新ref值
            xAxisRef.current = "";
            yAxisRef.current = "";
          }
        }
      };

      // 使用requestAnimationFrame确保状态更新在同一帧内完成
      window.requestAnimationFrame(() => {
        batchUpdate();
        // 在下一帧更新可筛选的维度，确保状态已更新
        setTimeout(() => {
          if (isMountedRef.current) {
            // 获取所有可用的维度
            const allDimensions = Object.keys(processedData.variables || {}).filter(key =>
              key.startsWith('v') &&
              processedData.variables?.[key] &&
              processedData.variables?.[key].values &&
              processedData.variables?.[key].values.length > 0
            );

            // 排除当前选择的X轴和Y轴
            const filterable = allDimensions.filter(dim =>
              dim !== xAxisRef.current &&
              dim !== yAxisRef.current
            );

            // 更新可筛选维度列表
            setFilterableDimensions(filterable);
          }
        }, 0);
      });
    } catch (err) {
      // 如果组件已卸载，不再更新状态
      if (!isMountedRef.current) return;

      // 检查是否是401错误（用户未授权）
      if (err && typeof err === 'object' && 'code' in err && err.code === 401) {
        logger.error("获取矩阵数据失败: 用户未授权");
        setError("登录已过期，请重新登录后再试");
        // 认证错误会由API拦截器统一处理重定向，这里只显示错误信息
      } else {
        logger.error("获取矩阵数据失败:", err);
        setError("获取矩阵数据失败，请刷新页面重试");
      }

      dataLoadedRef.current = false;
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }

      // 标记请求结束
      isRequestPendingRef.current = false;
    }
  }, []); // 不依赖任何状态，确保函数不会因为状态变化而重新创建

  // 只在组件挂载和任务ID变化时获取矩阵数据
  useEffect(() => {
    // 组件挂载标记设为true
    isMountedRef.current = true;

    // 如果有任务ID，且数据未加载或任务ID变化，则获取数据
    if (task?.id && (!dataLoadedRef.current || taskIdRef.current !== task.id)) {
      logger.log(`任务ID变化或数据未加载: ${taskIdRef.current} -> ${task.id}`);
      // 重置加载状态
      dataLoadedRef.current = false;
      // 重置筛选器
      setDimensionFilters([]);
      // 获取矩阵数据
      fetchMatrixData(task.id, false);
    }

    // 清理函数：组件卸载时将标记设置为false，防止异步操作更新已卸载组件的状态
    return () => {
      isMountedRef.current = false;
    };
  }, [task?.id, fetchMatrixData]); // 依赖于task.id和fetchMatrixData

  // 计算是否有batch标签，使用useMemo避免重复计算
  const hasBatchTagValue = useMemo(() => {
    if (task?.tags) {
      const batchTag = task.tags.find(
        (tag) => tag.type === "batch" && !tag.isVariable && parseInt(tag.value) > 1
      );

      return !!batchTag;
    }

    return false;
  }, [task?.tags]);

  // 单独处理batch标签检查，避免不必要的矩阵数据请求
  useEffect(() => {
    // 只有当计算的值与当前状态不同时才更新状态
    if (hasBatchTagValue !== hasBatchTag) {
      setHasBatchTag(hasBatchTagValue);
    }
  }, [hasBatchTagValue, hasBatchTag]);

  // 当X轴或Y轴变化时，更新可筛选的维度
  useEffect(() => {
    if (!matrixData || !matrixData.variables) {
      setFilterableDimensions([]);
      return;
    }

    // 获取所有可用的维度
    const allDimensions = Object.keys(matrixData.variables).filter(key =>
      key.startsWith('v') &&
      matrixData.variables[key] &&
      matrixData.variables[key].values &&
      matrixData.variables[key].values.length > 0
    );

    // 排除当前选择的X轴和Y轴
    const filterable = allDimensions.filter(dim =>
      dim !== xAxis &&
      dim !== yAxis
    );

    // 更新可筛选维度列表
    setFilterableDimensions(filterable);

    // 更新筛选器，移除不再可用的维度
    setDimensionFilters(prev =>
      prev.filter(filter =>
        filterable.includes(filter.dimension)
      )
    );
  }, [matrixData, xAxis, yAxis]);

  // 同步xAxis和yAxis的状态变化到ref中
  useEffect(() => {
    xAxisRef.current = xAxis;
  }, [xAxis]);

  useEffect(() => {
    yAxisRef.current = yAxis;
  }, [yAxis]);

  // 使用ref来缓存URL查询结果
  const urlCache = useRef<Record<string, string | null>>({});

  // 获取图片URL - 基于六维空间坐标
  const getImageUrl = useCallback(
    (xValue: string, yValue: string) => {
      if (!matrixData || !task) {
        logger.log("没有矩阵数据或任务数据");
        return null;
      }

      // 使用缓存来避免重复计算 - 包含筛选维度的值
      const filterString = dimensionFilters.map(f => `${f.dimension}:${f.valueIndex}`).join('_');
      const cacheKey = `${xAxis}_${xValue}_${yAxis}_${yValue}_${filterString}`;

      if (cacheKey in urlCache.current) {
        return urlCache.current[cacheKey];
      }

      // 为调试添加唯一ID，只在开发环境下生成
      const debugId =
        process.env.NODE_ENV === "development" ? Math.random().toString(36).substring(2, 8) : "";

      logger.log(`[${debugId}] 尝试获取 [${xValue}][${yValue}] 的图片URL，筛选条件: ${filterString}`);

      // 获取变量维度（0-5）
      const xVarDimension = xAxis ? parseInt(xAxis.substring(1)) : -1; // 从 'v0' 提取 0
      const yVarDimension = yAxis ? parseInt(yAxis.substring(1)) : -1; // 从 'v1' 提取 1

      // 查找 xValue 和 yValue 对应的索引
      let xValIndex: number | null = null;
      if (xAxis && matrixData.variables && matrixData.variables[xAxis] && matrixData.variables[xAxis].values) {
        const idx = matrixData.variables[xAxis].values.findIndex(v => v.value === xValue);
        if (idx !== -1) xValIndex = idx;
      }

      let yValIndex: number | null = null;
      if (yAxis && matrixData.variables && matrixData.variables[yAxis] && matrixData.variables[yAxis].values) {
        const idx = matrixData.variables[yAxis].values.findIndex(v => v.value === yValue);
        if (idx !== -1) yValIndex = idx;
      }

      // 存储匹配的图片URL
      const matchingUrls: string[] = [];

      // 从坐标映射中查找匹配的图片URL
      if (matrixData.coordinates_by_indices && Object.keys(matrixData.coordinates_by_indices).length > 0) {
        logger.log(`[${debugId}] 从索引坐标映射中查找匹配的图片`);

        // 遍历所有坐标映射
        for (const [indexedKey, url] of Object.entries(matrixData.coordinates_by_indices)) {
          // 将坐标字符串分解为数组
          const keyIndexParts = indexedKey.split(",");

          // 根据选择的轴决定查找策略
          let xMatches = !xAxis; // 如果没有选择X轴，则默认匹配
          if (xAxis && xVarDimension !== -1 && xValIndex !== null) {
            xMatches = (keyIndexParts[xVarDimension] === String(xValIndex));
          }

          let yMatches = !yAxis; // 如果没有选择Y轴，则默认匹配
          if (yAxis && yVarDimension !== -1 && yValIndex !== null) {
            yMatches = (keyIndexParts[yVarDimension] === String(yValIndex));
          }

          // 新增：检查其他维度的筛选条件
          let otherDimensionsMatch = true;
          for (const filter of dimensionFilters) {
            if (filter.valueIndex !== null) {
              const filterDimension = parseInt(filter.dimension.substring(1));
              // 如果筛选维度有效且不是X轴或Y轴
              if (filterDimension >= 0 &&
                filterDimension !== xVarDimension &&
                filterDimension !== yVarDimension) {
                // 检查该维度的值是否匹配
                if (keyIndexParts[filterDimension] !== String(filter.valueIndex)) {
                  otherDimensionsMatch = false;
                  break;
                }
              }
            }
          }

          // 如果所有条件都匹配，则添加URL
          if (xMatches && yMatches && otherDimensionsMatch) {
            logger.log(`[${debugId}] 找到匹配的图片URL:`, url);
            matchingUrls.push(url);
          }
        }
      } else {
        logger.log(`[${debugId}] 坐标映射为空或不存在`);
      }

      // 如果找到了匹配的URL，返回第一个
      if (matchingUrls.length > 0) {
        logger.log(`[${debugId}] 找到 ${matchingUrls.length} 个匹配的图片URL`);
        // 缓存结果
        urlCache.current[cacheKey] = matchingUrls[0];
        return matchingUrls[0];
      }

      // 如果没有找到匹配的URL，返回null
      logger.log(`[${debugId}] 未找到 [${xValue}][${yValue}] 的图片URL`);
      // 缓存空结果
      urlCache.current[cacheKey] = null;
      return null;
    },
    [matrixData, task, xAxis, yAxis, dimensionFilters]
  );

  // 获取所有匹配的图片URL - 用于显示同一参数组合下的多个batch图片
  const getAllMatchingImageUrls = useCallback(
    (xValue: string, yValue: string): string[] => {
      if (!matrixData || !task) {
        return [];
      }

      // 获取变量维度
      const xVarDimension = xAxis ? parseInt(xAxis.substring(1)) : -1;
      const yVarDimension = yAxis ? parseInt(yAxis.substring(1)) : -1;

      // 查找 xValue 和 yValue 对应的索引
      let xValIndex: number | null = null;
      if (xAxis && matrixData.variables && matrixData.variables[xAxis] && matrixData.variables[xAxis].values) {
        const idx = matrixData.variables[xAxis].values.findIndex(v => v.value === xValue);
        if (idx !== -1) xValIndex = idx;
      }

      let yValIndex: number | null = null;
      if (yAxis && matrixData.variables && matrixData.variables[yAxis] && matrixData.variables[yAxis].values) {
        const idx = matrixData.variables[yAxis].values.findIndex(v => v.value === yValue);
        if (idx !== -1) yValIndex = idx;
      }

      // 存储匹配的图片URL
      const matchingUrls: string[] = [];

      // 从坐标映射中查找匹配的图片URL
      if (matrixData.coordinates_by_indices && Object.keys(matrixData.coordinates_by_indices).length > 0) {
        // 遍历所有坐标映射
        for (const [indexedKey, url] of Object.entries(matrixData.coordinates_by_indices)) {
          const keyIndexParts = indexedKey.split(",");

          // 根据选择的轴决定查找策略
          let xMatches = !xAxis; // 如果没有选择X轴，则默认匹配
          if (xAxis && xVarDimension !== -1 && xValIndex !== null) {
            xMatches = (keyIndexParts[xVarDimension] === String(xValIndex));
          }

          let yMatches = !yAxis; // 如果没有选择Y轴，则默认匹配
          if (yAxis && yVarDimension !== -1 && yValIndex !== null) {
            yMatches = (keyIndexParts[yVarDimension] === String(yValIndex));
          }

          // 新增：检查其他维度的筛选条件
          let otherDimensionsMatch = true;
          for (const filter of dimensionFilters) {
            if (filter.valueIndex !== null) {
              const filterDimension = parseInt(filter.dimension.substring(1));
              // 如果筛选维度有效且不是X轴或Y轴
              if (filterDimension >= 0 &&
                filterDimension !== xVarDimension &&
                filterDimension !== yVarDimension) {
                // 检查该维度的值是否匹配
                if (keyIndexParts[filterDimension] !== String(filter.valueIndex)) {
                  otherDimensionsMatch = false;
                  break;
                }
              }
            }
          }

          // 如果所有条件都匹配，则添加URL
          if (xMatches && yMatches && otherDimensionsMatch) {
            matchingUrls.push(url);
          }
        }
      }

      return matchingUrls;
    },
    [matrixData, task, xAxis, yAxis, dimensionFilters]
  );

  // 处理变量值，处理重名情况
  const processVariableValues = useCallback(
    (values: string[]): [string[], Record<string, string>] => {
      const processedValues: string[] = [];
      const valueCounts: Record<string, number> = {};
      const valueMap: Record<string, string> = {};

      // 处理重名的情况
      values.forEach((value) => {
        if (value in valueCounts) {
          valueCounts[value]++;
          processedValues.push(`${value}#${valueCounts[value]}`);
        } else {
          valueCounts[value] = 0;
          processedValues.push(value);
        }
      });

      // 创建原始值和处理后值的映射
      values.forEach((originalValue, index) => {
        valueMap[processedValues[index]] = originalValue;
      });

      return [processedValues, valueMap];
    },
    []
  );

  // 预先缓存图片URL
  const cacheImageUrls = useCallback(
    (rowValues: string[], columnValues: string[]): Record<string, string | null> => {
      const imageUrlCache: Record<string, string | null> = {};

      // 预先计算所有可能的组合
      for (const rowValue of rowValues) {
        for (const colValue of columnValues) {
          let cacheKey = "";

          if (xAxis && yAxis) {
            cacheKey = `${colValue}:${rowValue}`;
          } else if (xAxis) {
            cacheKey = `${colValue}:`;
          } else if (yAxis) {
            cacheKey = `:${rowValue}`;
          }

          if (cacheKey && !imageUrlCache[cacheKey]) {
            // 使用getImageUrl函数查找图片URL
            let imageUrl = null;

            if (xAxis && yAxis) {
              imageUrl = getImageUrl(colValue, rowValue);
            } else if (xAxis) {
              imageUrl = getImageUrl(colValue, "");
            } else if (yAxis) {
              imageUrl = getImageUrl("", rowValue);
            }

            if (imageUrl) {
              imageUrlCache[cacheKey] = imageUrl;
            }
          }
        }
      }

      return imageUrlCache;
    },
    [xAxis, yAxis, getImageUrl]
  );

  // 创建表格单元格数据
  const createCellData = useCallback(
    (
      originalColValue: string,
      originalRowValue: string,
      imageUrlCache: Record<string, string | null>
    ): TableCellData => {
      // 从缓存中获取URL
      let imageUrl: string | null = null;
      let cacheKey = "";

      if (xAxis && yAxis) {
        cacheKey = `${originalColValue}:${originalRowValue}`;
      } else if (xAxis) {
        cacheKey = `${originalColValue}:`;
      } else if (yAxis) {
        cacheKey = `:${originalRowValue}`;
      }

      if (cacheKey) {
        imageUrl = imageUrlCache[cacheKey];
      }

      // 如果缓存中没有，尝试直接获取
      if (!imageUrl) {
        if (xAxis && yAxis) {
          imageUrl = getImageUrl(originalColValue, originalRowValue);
        } else if (xAxis && originalColValue) {
          imageUrl = getImageUrl(originalColValue, "");
        } else if (yAxis && originalRowValue) {
          imageUrl = getImageUrl("", originalRowValue);
        }
      }

      // 获取所有匹配的URL
      let matchingUrls: string[] = [];

      if (xAxis && yAxis) {
        matchingUrls = getAllMatchingImageUrls(originalColValue, originalRowValue);
      } else if (xAxis) {
        matchingUrls = getAllMatchingImageUrls(originalColValue, "");
      } else if (yAxis) {
        matchingUrls = getAllMatchingImageUrls("", originalRowValue);
      }

      // 构建单元格对象，即使没有找到图片URL也返回对象，但带有特殊标记
      return {
        url: imageUrl || (matchingUrls.length > 0 ? matchingUrls[0] : ""),
        urls: matchingUrls.length > 0 ? matchingUrls : imageUrl ? [imageUrl] : [],
        xValue: originalColValue || "",
        yValue: originalRowValue || "",
        coordinates: {},
        // 添加标记，表示这个单元格是否有有效的数据
        hasValidImage: !!(imageUrl || matchingUrls.length > 0),
      };
    },
    [xAxis, yAxis, getImageUrl, getAllMatchingImageUrls]
  );

  // 生成表格数据
  const generateTableData = useCallback((): TableRowData[] => {
    const debugId = Math.random().toString(36).substring(2, 8);

    if (!task || !matrixData) {
      logger.error("无法生成表格数据：任务对象或矩阵数据不存在");

      return [];
    }

    // 如果没有选择任何轴，返回空数组
    if (!xAxis && !yAxis) {
      return [];
    }

    // 初始化变量
    let columnValues: string[] = [""];
    let rowValues: string[] = [""];

    // 获取选中的变量数据
    const xAxisVar = xAxis ? task.variables[xAxis as keyof typeof task.variables] : null;
    const yAxisVar = yAxis ? task.variables[yAxis as keyof typeof task.variables] : null;

    // 获取变量值
    if (xAxisVar?.values) {
      columnValues = xAxisVar.values.map((val: any) => val.value || "");
    }

    if (yAxisVar?.values) {
      rowValues = yAxisVar.values.map((val: any) => val.value || "");
    }

    logger.log(`[${debugId}] 原始列值:`, columnValues);
    logger.log(`[${debugId}] 原始行值:`, rowValues);

    // 处理列值和行值中有重名的情况
    const [processedColumnValues, columnValueMap] = processVariableValues(columnValues);
    const [processedRowValues, rowValueMap] = processVariableValues(rowValues);

    logger.log(`[${debugId}] 处理后的列值:`, processedColumnValues);
    logger.log(`[${debugId}] 处理后的行值:`, processedRowValues);

    // 预先缓存图片URL
    const imageUrlCache = cacheImageUrls(rowValues, columnValues);

    logger.log(`[${debugId}] 图片URL缓存:`, imageUrlCache);

    // 生成表格数据
    return processedRowValues.map((processedRowValue) => {
      const originalRowValue = rowValueMap[processedRowValue];
      const rowData: TableRowData = {
        key: processedRowValue,
        rowTitle: processedRowValue,
      };

      // 为每个列值添加一个单元格
      processedColumnValues.forEach((processedColValue) => {
        const originalColValue = columnValueMap[processedColValue];

        // 创建单元格数据
        const cellData = createCellData(originalColValue, originalRowValue, imageUrlCache);

        // 更新：始终添加cellData，通过hasValidImage属性判断数据有效性
        rowData[processedColValue] = cellData;
        if (!cellData.hasValidImage) {
          logger.log(
            `[${debugId}] 没有为 [${originalColValue || ""}][${originalRowValue || ""}] 找到URL`
          );
        }
      });

      return rowData;
    });
  }, [task, matrixData, xAxis, yAxis, processVariableValues, cacheImageUrls, createCellData]);

  // 计算表格数据，使用useMemo缓存结果，只在依赖项变化时重新计算
  const tableData = useMemo<TableRowData[]>(() => {
    // 只在必要的条件满足时才生成表格数据
    if (!task || !matrixData || (!xAxis && !yAxis)) {
      return [];
    }

    return generateTableData();
  }, [task, matrixData, xAxis, yAxis, generateTableData]);

  // 创建一个调试ID引用，用于跟踪日志
  const debugIdRef = useRef(`debug-${Math.random().toString(36).substring(2, 8)}`);

  // 添加调试代码，验证数据获取和渲染，仅在开发环境下执行
  useEffect(() => {
    // 只在开发环境下输出调试信息
    if (process.env.NODE_ENV !== "development") return;

    // 获取调试ID
    const debugId = debugIdRef.current;

    // 避免频繁执行，使用防抖
    const timeoutId = setTimeout(() => {
      if (tableData && tableData.length > 0) {
        logger.log(`[${debugId}] --------- 表格数据验证 ---------`);
        logger.log(`[${debugId}] 可用变量:`, availableVariables);
        logger.log(`[${debugId}] 过滤后的变量名:`, variableNames);

        // 获取表格中实际显示的X和Y值
        const xAxisVar = xAxis ? task?.variables?.[xAxis as keyof typeof task.variables] : null;
        const yAxisVar = yAxis ? task?.variables?.[yAxis as keyof typeof task.variables] : null;

        const columnValues = xAxisVar?.values?.map((val: any) => val.value) || [""];
        const rowValues = yAxisVar?.values?.map((val: any) => val.value) || [""];

        logger.log(`[${debugId}] X轴变量:`, xAxis, "值:", columnValues);
        logger.log(`[${debugId}] Y轴变量:`, yAxis, "值:", rowValues);

        // 验证所有单元格URL - 仅在首次渲染时执行一次
        if (!urlValidationDoneRef.current) {
          urlValidationDoneRef.current = true;

          let totalCells = 0;
          let foundUrls = 0;

          for (const rowValue of rowValues) {
            for (const colValue of columnValues) {
              totalCells++;
              let url = null;

              if (xAxis && yAxis) {
                url = getImageUrl(colValue, rowValue);
              } else if (xAxis) {
                url = getImageUrl(colValue, "");
              } else if (yAxis) {
                url = getImageUrl("", rowValue);
              }

              if (url) {
                foundUrls++;
                logger.log(
                  `[${debugId}] 单元格[${rowValue || ""}][${colValue || ""}] 找到URL:`,
                  url
                );
              } else {
                logger.log(`[${debugId}] 单元格[${rowValue || ""}][${colValue || ""}] 未找到URL`);
              }
            }
          }

          logger.log(`[${debugId}] 总单元格: ${totalCells}, 找到URL的: ${foundUrls}`);
        }

        logger.log(`[${debugId}] ---------------------------`);
      } else {
        logger.log(`[${debugId}] tableData为空，无法渲染表格`);
      }
    }, 500); // 添加500ms延迟，避免频繁执行

    // 清理函数
    return () => {
      clearTimeout(timeoutId);
    };
  }, [tableData, xAxis, yAxis, availableVariables, variableNames, task, getImageUrl]); // 移除不必要的依赖项

  // 处理维度筛选器变化
  const handleDimensionFilterChange = (dimension: string, valueIndex: number | null) => {
    // 检查是否已存在该维度的筛选器
    const existingFilterIndex = dimensionFilters.findIndex(f => f.dimension === dimension);

    if (existingFilterIndex !== -1) {
      // 更新现有筛选器
      const updatedFilters = [...dimensionFilters];
      updatedFilters[existingFilterIndex] = { dimension, valueIndex };
      setDimensionFilters(updatedFilters);
    } else {
      // 添加新筛选器
      setDimensionFilters([...dimensionFilters, { dimension, valueIndex }]);
    }

    // 清除URL缓存，因为筛选条件已更改
    urlCache.current = {};

    // 记录筛选条件变化
    logger.log(`维度筛选条件变化: ${dimension} = ${valueIndex !== null ? valueIndex : '全部'}`);
  };

  // 处理全屏模式切换
  const toggleFullscreen = () => {
    if (!fullscreenElementRef.current) return;

    if (!document.fullscreenElement) {
      fullscreenElementRef.current
        .requestFullscreen()
        .then(() => {
          setIsFullscreen(true);
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error(`全屏请求失败: ${err.message}`);
        });
    } else {
      document
        .exitFullscreen()
        .then(() => {
          setIsFullscreen(false);
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error(`退出全屏失败: ${err.message}`);
        });
    }
  };

  // 监听全屏状态变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {isLoading && (
        <div className="flex justify-center items-center p-8">
          <Spinner size="lg" />
          <span className="ml-2">正在加载数据...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded mb-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Icon className="w-5 h-5 mr-2" icon="heroicons:exclamation-circle" />
              <span>{error}</span>
            </div>
            <Button
              color="primary"
              size="sm"
              startContent={<Icon icon="solar:refresh-linear" width={16} />}
              onPress={() => {
                // 重试获取矩阵数据
                dataLoadedRef.current = false;
                if (task?.id) {
                  fetchMatrixData(task.id);
                }
              }}
            >
              重试加载
            </Button>
          </div>
        </div>
      )}

      <div className="mb-4">
        <h2
          className="text-xl font-semibold mb-2"
          title={task.task_name || `任务 ID: ${task.id}`}
        >
          {(task.task_name && task.task_name.length > 8)
            ? `${task.task_name.substring(0, 8)}...`
            : (task.task_name || `任务 ID: ${task.id.substring(0, 8)}`)}
        </h2>
        <p className="text-sm text-default-500">
          创建时间: {formatBeijingTime(task.created_at)}
        </p>
      </div>

      {availableVariables.length >= 1 ? (
        <Card className="mb-6">
          <CardHeader>
            <h3 className="text-lg font-semibold">XY表格设置</h3>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                key={`x-axis-select-${xAxis || "empty"}`}
                className="w-full"
                label="X轴变量"
                placeholder="选择X轴变量"
                selectedKeys={xAxis ? [xAxis] : []}
                onSelectionChange={(keys) => {
                  const keysArray = Array.from(keys);

                  if (keysArray.length > 0) {
                    const newXAxis = keysArray[0] as string;

                    // 如果新选择的X轴与当前Y轴相同，则清空Y轴
                    if (newXAxis === yAxis) {
                      setYAxis("");
                    }
                    setXAxis(newXAxis);
                    // eslint-disable-next-line no-console
                    // eslint-disable-next-line no-console
                    // eslint-disable-next-line no-console
                    console.log("已选择X轴变量:", newXAxis);
                  } else {
                    setXAxis("");
                    // eslint-disable-next-line no-console
                    // eslint-disable-next-line no-console
                    // eslint-disable-next-line no-console
                    console.log("已清空X轴变量");
                  }
                }}
              >
                {availableVariables.map((variable) => (
                  <SelectItem key={variable}>
                    {`${variable}:${variableNames[variable] || ""}`}
                  </SelectItem>
                ))}
              </Select>
              <Select
                key={`y-axis-select-${yAxis || "empty"}`}
                className="w-full"
                label="Y轴变量"
                placeholder="选择Y轴变量"
                selectedKeys={yAxis ? [yAxis] : []}
                onSelectionChange={(keys) => {
                  const keysArray = Array.from(keys);

                  if (keysArray.length > 0) {
                    const newYAxis = keysArray[0] as string;

                    // 如果新选择的Y轴与当前X轴相同，则清空X轴
                    if (newYAxis === xAxis) {
                      setXAxis("");
                    }
                    setYAxis(newYAxis);
                    // eslint-disable-next-line no-console
                    // eslint-disable-next-line no-console
                    // eslint-disable-next-line no-console
                    console.log("已选择Y轴变量:", newYAxis);
                  } else {
                    setYAxis("");
                    // eslint-disable-next-line no-console
                    // eslint-disable-next-line no-console
                    // eslint-disable-next-line no-console
                    console.log("已清空Y轴变量");
                  }
                }}
              >
                {availableVariables.map((variable) => (
                  <SelectItem
                    key={variable}
                    className={variable === xAxis ? "opacity-50 pointer-events-none" : ""}
                  >
                    {`${variable}:${variableNames[variable] || ""}`}
                  </SelectItem>
                ))}
              </Select>
            </div>
            {/* 添加其他维度的筛选器 */}
            {filterableDimensions.length > 0 && (
              <div className="mt-6">
                <h4 className="text-md font-medium mb-2">其他维度筛选</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filterableDimensions.map((dimension) => {
                    // 获取当前维度的变量数据
                    const varData = matrixData?.variables?.[dimension];
                    // 获取当前维度的筛选值
                    const currentFilter = dimensionFilters.find(f => f.dimension === dimension);
                    const currentValueIndex = currentFilter?.valueIndex;

                    return (
                      <Select
                        key={`filter-${dimension}`}
                        className="w-full"
                        label={`${dimension}: ${variableNames[dimension] || ""}`}
                        placeholder={`选择${variableNames[dimension] || dimension}的值`}
                        selectedKeys={currentValueIndex !== null ? [`${currentValueIndex}`] : []}
                        onSelectionChange={(keys) => {
                          const keysArray = Array.from(keys);
                          if (keysArray.length > 0) {
                            const valueIndex = parseInt(keysArray[0] as string);
                            handleDimensionFilterChange(dimension, valueIndex);
                          } else {
                            // 如果没有选择，则设置为null（表示不筛选）
                            handleDimensionFilterChange(dimension, null);
                          }
                        }}
                      >
                        <SelectItem key="all">全部</SelectItem>
                        {varData?.values?.map((value, index) => (
                          <SelectItem key={`${index}`}>
                            {value.value}
                          </SelectItem>
                        ))}
                      </Select>
                    );
                  })}
                </div>
                <div className="mt-2 flex justify-between items-center">
                  <div className="text-xs text-default-500">
                    <p>选择"全部"表示不对该维度进行筛选</p>
                  </div>
                  {dimensionFilters.length > 0 && (
                    <Button
                      color="danger"
                      size="sm"
                      startContent={<Icon icon="solar:restart-bold-duotone" width={16} />}
                      variant="light"
                      onPress={() => {
                        // 重置所有筛选器
                        setDimensionFilters([]);
                        // 清除URL缓存
                        urlCache.current = {};
                        logger.log("已重置所有维度筛选器");
                      }}
                    >
                      重置筛选
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mt-4">
              <div className="text-xs text-default-500">
                <p>注：只有具有有效名称的变量会显示在选择器中</p>
                <p>至少选择一个轴才能显示表格</p>
                {Object.entries(task.variables || {}).some(
                  ([_, value]) => typeof value === "object" && "name" in value && value.name === ""
                ) && <p className="text-warning mt-1">当前任务中有未命名变量未显示</p>}
              </div>
              {(xAxis || yAxis) && (
                <Button
                  color="primary"
                  size="sm"
                  startContent={<Icon icon="solar:refresh-linear" width={16} />}
                  variant="bordered"
                  onPress={() => {
                    // 强制刷新表格数据
                    logger.log("手动刷新表格数据");

                    // 使用强制刷新参数
                    if (task?.id) {
                      fetchMatrixData(task.id, true);
                    }
                  }}
                >
                  刷新表格
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardBody>
            <div className="text-center text-default-500">此任务没有足够的变量来创建表格</div>
          </CardBody>
        </Card>
      )}

      {(xAxis || yAxis) && tableData && tableData.length > 0 && (
        <Card>
          <CardHeader className="flex flex-col gap-2">
            <div className="flex justify-between items-center w-full">
              <h3 className="text-lg font-semibold">结果表格</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-default-500">缩放：</span>
                  <Slider
                    aria-label="表格缩放比例"
                    className="w-32"
                    defaultValue={100}
                    maxValue={100}
                    minValue={30}
                    size="sm"
                    step={5}
                    value={tableScale}
                    onChange={(value) => setTableScale(typeof value === "number" ? value : value[0])}
                  />
                  <span className="text-xs text-default-500">{tableScale}%</span>
                </div>
                <Button
                  size="sm"
                  startContent={
                    <Icon
                      icon={isFullscreen ? "solar:exit-bold-linear" : "solar:maximize-bold-linear"}
                      width={18}
                    />
                  }
                  variant="bordered"
                  onPress={toggleFullscreen}
                >
                  {isFullscreen ? "退出全屏" : "全屏查看"}
                </Button>
              </div>
            </div>

            {/* 显示当前筛选条件 */}
            {dimensionFilters.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                <span className="text-xs text-default-500">当前筛选：</span>
                {dimensionFilters.map(filter => {
                  if (filter.valueIndex === null) return null;

                  const dimension = filter.dimension;
                  const varData = matrixData?.variables?.[dimension];
                  const valueData = varData?.values?.[filter.valueIndex];
                  const displayValue = valueData?.value || `索引 ${filter.valueIndex}`;
                  const dimensionName = variableNames[dimension] || dimension;

                  return (
                    <div
                      key={`filter-tag-${dimension}`}
                      className="bg-default-100 text-default-700 text-xs px-2 py-1 rounded-full flex items-center gap-1"
                    >
                      <span>{dimensionName}: {displayValue}</span>
                      <button
                        className="text-default-500 hover:text-danger"
                        onClick={() => handleDimensionFilterChange(dimension, null)}
                      >
                        <Icon icon="solar:close-circle-bold" width={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardHeader>
          <CardBody>
            <div
              ref={fullscreenElementRef}
              className={`overflow-x-auto ${isFullscreen ? "fullscreen-table" : ""}`}
              style={{ maxWidth: "100%", overflowX: "scroll" }}
            >
              <table
                className="border-collapse"
                style={{
                  tableLayout: "fixed",
                  width: "auto",
                  borderSpacing: "8px",
                  borderCollapse: "separate",
                  borderRadius: 0,
                  transform: `scale(${tableScale / 100})`,
                  transformOrigin: "top left",
                  transition: "transform 0.2s ease",
                }}
              >
                <thead>
                  <tr>
                    <th
                      className="border p-1 bg-default-100 text-xs w-20"
                      style={{
                        minWidth: "80px",
                        borderRadius: 0,
                        border: "1px solid #e0e0e0",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                      }}
                    >
                      {xAxis && yAxis
                        ? `${xAxis}:${variableNames[xAxis] || ""} / ${yAxis}:${variableNames[yAxis] || ""}`
                        : xAxis
                          ? `${xAxis}:${variableNames[xAxis] || ""}`
                          : yAxis
                            ? `${yAxis}:${variableNames[yAxis] || ""}`
                            : ""}
                    </th>
                    {/* 获取第一行的所有列键作为列头 */}
                    {tableData.length > 0 &&
                      Object.keys(tableData[0])
                        .filter((key) => key !== "key" && key !== "rowTitle")
                        .map((colKey, colIndex) => (
                          <th
                            key={`col-${colIndex}-${colKey}`}
                            className="border p-1 bg-default-100 text-xs"
                            style={{
                              width: "200px",
                              minWidth: "200px",
                              maxWidth: "200px",
                              borderRadius: 0,
                              border: "1px solid #e0e0e0",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                            }}
                          >
                            <span title={colKey}>
                              {colKey.length > 8 ? `${colKey.substring(0, 8)}...` : colKey}
                            </span>
                          </th>
                        ))}
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row: TableRowData, rowIndex: number) => (
                    <tr key={`row-${rowIndex}-${row.key}`}>
                      <td
                        className="border p-1 font-medium bg-default-50 text-xs w-20"
                        style={{
                          minWidth: "80px",
                          borderRadius: 0,
                          border: "1px solid #e0e0e0",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                        }}
                      >
                        <span title={row.rowTitle}>
                          {row.rowTitle.length > 8 ? `${row.rowTitle.substring(0, 8)}...` : row.rowTitle}
                        </span>
                      </td>
                      {Object.keys(row)
                        .filter((key) => key !== "key" && key !== "rowTitle")
                        .map((colKey, colIndex) => {
                          const cell = row[colKey] as TableCellData;
                          const imageUrl = cell.hasValidImage ? cell.url : "";
                          const cellTitle = `${row.rowTitle}-${colKey}`;

                          return (
                            <td
                              key={`cell-${rowIndex}-${colIndex}-${colKey}`}
                              className="border p-0 text-center"
                              style={{
                                width: "200px",
                                height: "200px",
                                minWidth: "200px",
                                minHeight: "200px",
                                borderRadius: 0,
                                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                                border: "1px solid #e0e0e0",
                                padding: 0,
                              }}
                            >
                              {cell.hasValidImage ? (
                                <div className="w-full h-full">
                                  {/* 如果有多张图片且是批次任务，显示网格 */}
                                  {cell.urls && cell.urls.length > 1 && hasBatchTag ? (
                                    <div
                                      className={`grid gap-1 ${getGridColumns(cell.urls.length)} w-full h-full bg-default-50 overflow-hidden`}
                                      style={{ gridAutoRows: "1fr" }}
                                    >
                                      {cell.urls.map((url, index) => (
                                        <div
                                          key={index}
                                          className="relative overflow-hidden cursor-pointer bg-default-50"
                                          role="button"
                                          tabIndex={0}
                                          onClick={() => {
                                            viewImageInModal(
                                              url,
                                              `${cellTitle} - 批次 ${index + 1}`
                                            );
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              viewImageInModal(
                                                url,
                                                `${cellTitle} - 批次 ${index + 1}`
                                              );
                                            }
                                          }}
                                        >
                                          <div className="w-full h-full flex items-center justify-center">
                                            <Image
                                              alt={`${cellTitle} - 批次 ${index + 1}`}
                                              className="max-w-full max-h-full"
                                              height="auto"
                                              radius="none"
                                              src={getResizedImageUrl(
                                                url,
                                                getImageSizeByBatchCount(cell.urls?.length || 1)
                                              )}
                                              style={{
                                                objectFit: "none",
                                                width: "auto",
                                                height: "auto",
                                              }}
                                              width="auto"
                                              onError={() => {
                                                logger.log("图片加载失败:", url);
                                                const imgSrc = getResizedImageUrl(
                                                  url,
                                                  getImageSizeByBatchCount(cell.urls?.length || 1)
                                                );

                                                if (imgSrc) {
                                                  const errorElement = document.querySelector(`img[src="${imgSrc}"]`) as HTMLImageElement | null;

                                                  if (errorElement && errorElement.parentElement) {
                                                    // 创建提示元素
                                                    const errorText = document.createElement('div');
                                                    errorText.className = "absolute inset-0 flex items-center justify-center bg-default-50 text-xs text-default-500";
                                                    errorText.innerHTML = `<span>图片加载失败</span>`;
                                                    errorElement.parentElement.appendChild(errorText);
                                                    // 隐藏加载失败的图片
                                                    errorElement.style.display = 'none';
                                                  }
                                                }
                                              }}
                                            />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div
                                      className="w-full h-full bg-default-50 overflow-hidden cursor-pointer"
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => {
                                        cell.urls && cell.urls.length > 0
                                          ? viewMultipleImagesInModal(cell.urls, cellTitle)
                                          : viewImageInModal(imageUrl, cellTitle);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          cell.urls && cell.urls.length > 0
                                            ? viewMultipleImagesInModal(cell.urls, cellTitle)
                                            : viewImageInModal(imageUrl, cellTitle);
                                        }
                                      }}
                                    >
                                      <div className="w-full h-full flex items-center justify-center">
                                        <Image
                                          alt={cellTitle}
                                          className="max-w-full max-h-full"
                                          height="auto"
                                          radius="none"
                                          src={getResizedImageUrl(imageUrl, getImageSizeByBatchCount(1))}
                                          style={{
                                            objectFit: "none",
                                            width: "auto",
                                            height: "auto",
                                          }}
                                          width="auto"
                                          onError={() => {
                                            logger.log("图片加载失败:", imageUrl);
                                            const imgSrc = getResizedImageUrl(imageUrl, getImageSizeByBatchCount(1));

                                            if (imgSrc) {
                                              const errorElement = document.querySelector(`img[src="${imgSrc}"]`) as HTMLImageElement | null;

                                              if (errorElement && errorElement.parentElement) {
                                                // 创建提示元素
                                                const errorText = document.createElement('div');
                                                errorText.className = "absolute inset-0 flex items-center justify-center bg-default-50 text-xs text-default-500";
                                                errorText.innerHTML = `<span>图片加载失败</span>`;
                                                errorElement.parentElement.appendChild(errorText);
                                                // 隐藏加载失败的图片
                                                errorElement.style.display = 'none';
                                              }
                                            }
                                          }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="w-full h-full">
                                  <div className="w-full h-full flex items-center justify-center bg-default-50 overflow-hidden">
                                    <div className="text-center p-4">
                                      <div className="flex flex-col items-center">
                                        <Icon icon="solar:missing-circular-linear" className="w-8 h-8 text-default-300 mb-2" />
                                        <p className="text-default-500 text-sm font-medium">未找到图片</p>
                                        <div className="mt-2 text-default-400 text-xs space-y-1">
                                          {xAxis && (
                                            <p title={`${xAxis}:${(cell as TableCellData)?.xValue || colKey.replace(/#\d+$/, "")}`}>
                                              {(() => {
                                                const text = `${xAxis}:${(cell as TableCellData)?.xValue || colKey.replace(/#\d+$/, "")}`;
                                                return text.length > 8 ? `${text.substring(0, 8)}...` : text;
                                              })()}
                                            </p>
                                          )}
                                          {yAxis && (
                                            <p title={`${yAxis}:${(cell as TableCellData)?.yValue || row.rowTitle.replace(/#\d+$/, "")}`}>
                                              {(() => {
                                                const text = `${yAxis}:${(cell as TableCellData)?.yValue || row.rowTitle.replace(/#\d+$/, "")}`;
                                                return text.length > 8 ? `${text.substring(0, 8)}...` : text;
                                              })()}
                                            </p>
                                          )}
                                          <p className="text-default-300 mt-1">无匹配数据</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </td>
                          );
                        })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* 添加无表格数据时的提示 */}
      {(xAxis || yAxis) && (!tableData || tableData.length === 0) && (
        <Card>
          <CardBody>
            <div className="text-center p-8">
              <p className="text-default-500 mb-2">无法生成表格数据</p>
              <p className="text-default-400 text-sm">可能原因：</p>
              <ul className="text-default-400 text-sm list-disc list-inside mt-2">
                <li>所选变量没有对应的结果数据</li>
                <li>任务结果格式不兼容</li>
                <li>任务尚未完成所有子任务</li>
              </ul>
              <p className="text-default-400 text-sm mt-4">请尝试选择其他变量组合或检查任务状态</p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* 图片查看模态框 */}
      <Modal isOpen={isImageModalOpen} size="5xl" onClose={() => setIsImageModalOpen(false)}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">{currentImageTitle || "图片查看"}</h3>
                  {!isGridView && currentImageUrl && (
                    <p className="text-xs text-default-500 mt-1">
                      {getCoordinateInfo(currentImageUrl)}
                    </p>
                  )}
                  {isGridView && (
                    <p className="text-xs text-default-500 mt-1">
                      批量图片: {currentImageUrls.length} 张
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {currentImageUrls.length > 1 && hasBatchTag && (
                    <Button
                      color="primary"
                      size="sm"
                      startContent={
                        <Icon
                          icon={
                            isGridView
                              ? "solar:square-single-linear"
                              : "solar:square-multiple-linear"
                          }
                          width={16}
                        />
                      }
                      variant="bordered"
                      onPress={() => setIsGridView(!isGridView)}
                    >
                      {isGridView ? "单张查看" : "网格查看"}
                    </Button>
                  )}
                </div>
              </ModalHeader>
              <ModalBody className="bg-default-900 p-4 overflow-auto" style={{ minHeight: "60vh" }}>
                {!isGridView && currentImageUrl && (
                  <div className="flex items-center justify-center">
                    <Image
                      alt={currentImageTitle}
                      className="max-w-full max-h-full object-contain"
                      height="auto"
                      src={currentImageUrl || PLACEHOLDER_IMAGE_URL} // 使用原始URL，不添加缩放参数，确保有默认值
                      style={{ maxHeight: "70vh", objectFit: "contain" }}
                      width="auto"
                      onError={() => {
                        logger.log("大图加载失败:", currentImageUrl);
                        // 查找图片元素并替换为错误提示
                        if (currentImageUrl) {
                          const errorElement = document.querySelector(`img[src="${currentImageUrl || PLACEHOLDER_IMAGE_URL}"]`) as HTMLImageElement | null;

                          if (errorElement && errorElement.parentElement) {
                            // 创建错误提示元素
                            const errorContainer = document.createElement('div');
                            errorContainer.className = "flex flex-col items-center justify-center";
                            errorContainer.innerHTML = `
                              <div class="mb-4">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#999999" stroke-width="1.5"/>
                                  <path d="M12 8V13" stroke="#999999" stroke-width="1.5" stroke-linecap="round"/>
                                  <circle cx="12" cy="16" r="1" fill="#999999"/>
                                </svg>
                              </div>
                              <div class="text-default-500 text-sm font-medium">图片加载失败</div>
                            `;

                            // 替换图片元素
                            errorElement.style.display = 'none';
                            errorElement.parentElement.appendChild(errorContainer);
                          }
                        }
                      }}
                    />
                  </div>
                )}

                {isGridView && currentImageUrls.length > 0 && hasBatchTag && (
                  <div
                    className={`grid gap-4 ${getGridColumns(currentImageUrls.length)}`}
                    style={{ gridAutoRows: "minmax(300px, auto)" }}
                  >
                    {currentImageUrls.map((url, index) => (
                      <div
                        key={index}
                        className="relative overflow-hidden border border-default-200 cursor-pointer flex items-center justify-center bg-default-50"
                        role="button"
                        style={{ minHeight: "300px" }}
                        tabIndex={0}
                        onClick={() => {
                          setCurrentImageUrl(url);
                          setIsGridView(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setCurrentImageUrl(url);
                            setIsGridView(false);
                          }
                        }}
                      >
                        <div className="w-full h-full flex items-center justify-center">
                          <Image
                            alt={`${currentImageTitle} - 批次 ${index + 1}`}
                            className="object-contain max-w-full max-h-full"
                            height="auto"
                            src={
                              getResizedImageUrl(
                                url,
                                getImageSizeByBatchCount(currentImageUrls.length)
                              ) || PLACEHOLDER_IMAGE_URL
                            }
                            style={{ objectFit: "contain" }}
                            width="auto"
                            onError={() => {
                              logger.log("网格图片加载失败:", url);
                              // 查找图片元素并替换为错误提示
                              const imgSrc = getResizedImageUrl(
                                url,
                                getImageSizeByBatchCount(currentImageUrls.length)
                              ) || PLACEHOLDER_IMAGE_URL;

                              if (imgSrc) {
                                const errorElement = document.querySelector(`img[src="${imgSrc}"]`) as HTMLImageElement | null;

                                if (errorElement && errorElement.parentElement) {
                                  // 创建错误提示元素
                                  const errorText = document.createElement('div');
                                  errorText.className = "absolute inset-0 flex items-center justify-center bg-default-50 text-xs text-default-500";
                                  errorText.innerHTML = `<span>图片加载失败</span>`;

                                  // 替换图片元素
                                  errorElement.style.display = 'none';
                                  errorElement.parentElement.appendChild(errorText);
                                }
                              }
                            }}
                          />
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 text-center">
                          批次 {index + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button
                  color="primary"
                  startContent={<Icon icon="solar:close-circle-linear" width={18} />}
                  variant="bordered"
                  onPress={onClose}
                >
                  关闭
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};

// 同时保留默认导出
export default TaskDetailView;
