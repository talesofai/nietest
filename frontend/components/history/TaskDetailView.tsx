import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { getTaskMatrix } from "@/utils/taskService";

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
}

interface TableRowData {
  key: string;
  rowTitle: string;
  [columnKey: string]: TableCellData | string | null;
}

// 矩阵数据接口
interface MatrixData {
  task_id: string;
  task_name: string;
  created_at: string;
  variables: Record<string, any>;
  coordinates: Record<string, string>; // 坐标字符串 -> URL映射
}

// 提取状态管理到自定义钩子
const useTaskDetailState = () => {
  const [xAxis, setXAxis] = useState<string | null>(null);
  const [yAxis, setYAxis] = useState<string | null>(null);
  const [availableVariables, setAvailableVariables] = useState<string[]>([]);
  const [variableNames, setVariableNames] = useState<Record<string, string>>({});
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [fullscreenElement, setFullscreenElement] = useState<HTMLElement | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false);
  const [currentImageUrl, setCurrentImageUrl] = useState<string>("");
  const [currentImageTitle, setCurrentImageTitle] = useState<string>("");
  const [currentImageUrls, setCurrentImageUrls] = useState<string[]>([]);
  const [isGridView, setIsGridView] = useState<boolean>(false);
  const [hasBatchTag, setHasBatchTag] = useState<boolean>(false);

  // 矩阵数据 - 从后端获取的六维空间坐标系统
  const [matrixData, setMatrixData] = useState<MatrixData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 表格缩放控制
  const [tableScale, setTableScale] = useState<number>(100);

  return {
    xAxis,
    setXAxis,
    yAxis,
    setYAxis,
    availableVariables,
    setAvailableVariables,
    variableNames,
    setVariableNames,
    isFullscreen,
    setIsFullscreen,
    fullscreenElement,
    setFullscreenElement,
    isImageModalOpen,
    setIsImageModalOpen,
    currentImageUrl,
    setCurrentImageUrl,
    currentImageTitle,
    setCurrentImageTitle,
    currentImageUrls,
    setCurrentImageUrls,
    isGridView,
    setIsGridView,
    hasBatchTag,
    setHasBatchTag,
    matrixData,
    setMatrixData,
    isLoading,
    setIsLoading,
    error,
    setError,
    tableScale,
    setTableScale,
  };
};

export const TaskDetailView: React.FC<TaskDetailViewProps> = ({ task }) => {
  const {
    xAxis,
    setXAxis,
    yAxis,
    setYAxis,
    availableVariables,
    setAvailableVariables,
    variableNames,
    setVariableNames,
    isFullscreen,
    setIsFullscreen,
    fullscreenElement,
    setFullscreenElement,
    isImageModalOpen,
    setIsImageModalOpen,
    currentImageUrl,
    setCurrentImageUrl,
    currentImageTitle,
    setCurrentImageTitle,
    currentImageUrls,
    setCurrentImageUrls,
    isGridView,
    setIsGridView,
    hasBatchTag,
    setHasBatchTag,
    matrixData,
    setMatrixData,
    isLoading,
    setIsLoading,
    error,
    setError,
    tableScale,
    setTableScale,
  } = useTaskDetailState();

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
    const coordEntry = Object.entries(matrixData.coordinates).find(([_, url]) => url === imageUrl);

    if (!coordEntry) {
      return "无坐标信息";
    }

    const coordKey = coordEntry[0];

    // 将坐标字符串分解为数组，例如 "0,1,,2,," => ["0", "1", "", "2", "", ""]
    const coordParts = coordKey.split(",");

    // 构建坐标信息
    const coordInfoParts = coordParts.map((value, index) => {
      if (value === "") return null; // 跳过空坐标

      const varKey = `v${index}`;
      const varName = variableNames[varKey] || varKey;

      // 获取该维度的变量信息
      return getCoordinatePart(varKey, varName, value);
    });

    const coordInfo = coordInfoParts.filter(Boolean).join(", ");

    return coordInfo || "无坐标信息";
  };

  // 提取获取单个坐标部分信息的逻辑
  const getCoordinatePart = (varKey: string, varName: string, value: string): string | null => {
    if (!matrixData || !value) return null;

    // 尝试获取该维度的实际值而不仅是索引
    const varInfo = matrixData.variables[varKey];
    let displayValue: string | number = value;

    const hasValidValues =
      varInfo &&
      typeof varInfo === "object" &&
      "values" in varInfo &&
      Array.isArray(varInfo.values);

    if (hasValidValues) {
      const idx = parseInt(value);
      const values = (varInfo as any).values;

      const isValidIndex =
        !isNaN(idx) && idx >= 0 && idx < values.length && values[idx] && "value" in values[idx];

      if (isValidIndex) {
        displayValue = `${values[idx].value}(${idx})`;
      }
    }

    return `${varKey}(${varName}): ${displayValue}`;
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
    if (imageCount <= 1) return 180; // 调整为更合适的尺寸
    if (imageCount <= 4) return 90; // 调整为更合适的尺寸
    if (imageCount <= 9) return 60; // 调整为更合适的尺寸
    if (imageCount <= 16) return 45; // 调整为更合适的尺寸

    return 20; // 如果超过16张，使用更小的尺寸
  };

  // 从后端获取矩阵数据
  const fetchMatrixData = useCallback(async () => {
    if (!task || !task.id) return;

    setIsLoading(true);
    setError(null);

    try {
      // 调用后端API获取矩阵数据
      const response = await getTaskMatrix(task.id);

      if (!response.success || !response.data) {
        throw new Error(response.error || "获取矩阵数据失败");
      }

      // 设置矩阵数据
      setMatrixData(response.data);

      // 提取变量名称和可用变量
      const variables: string[] = [];
      const varNames: Record<string, string> = {};

      if (response.data.variables) {
        Object.entries(response.data.variables).forEach(([key, value]) => {
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

      // 存储变量名称映射
      setVariableNames(varNames);
      setAvailableVariables(variables);

      // 默认选择前两个变量作为X轴和Y轴
      if (variables.length >= 2) {
        setXAxis(variables[0]);
        setYAxis(variables[1]);
      } else if (variables.length === 1) {
        setXAxis(variables[0]);
        setYAxis("");
      } else {
        setXAxis("");
        setYAxis("");
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      // eslint-disable-next-line no-console
      // eslint-disable-next-line no-console
      console.error("Error fetching matrix data:", err);
      setError("获取矩阵数据失败，请刷新页面重试");
    } finally {
      setIsLoading(false);
    }
  }, [
    task,
    setIsLoading,
    setError,
    setMatrixData,
    setVariableNames,
    setAvailableVariables,
    setXAxis,
    setYAxis,
  ]);

  // 当任务变化时，获取矩阵数据并检查批次标签
  useEffect(() => {
    fetchMatrixData();

    // 检查是否有batch标签
    if (task && task.tags) {
      const batchTag = task.tags.find(
        (tag) => tag.type === "batch" && !tag.isVariable && parseInt(tag.value) > 1
      );

      setHasBatchTag(!!batchTag);
    } else {
      setHasBatchTag(false);
    }
  }, [fetchMatrixData, task, setHasBatchTag]);

  // 判断坐标是否匹配
  const isCoordinateMatch = useCallback(
    (
      coordParts: string[],
      xVarIndex: number | null,
      yVarIndex: number | null,
      xValue: string,
      yValue: string,
      debugId: string,
      url: string
    ): boolean => {
      // 两个轴都有值
      if (xAxis && yAxis && xVarIndex !== null && yVarIndex !== null) {
        if (coordParts[xVarIndex] === xValue && coordParts[yVarIndex] === yValue) {
          // eslint-disable-next-line no-console
          console.log(`[${debugId}] 找到匹配的图片URL(双轴):`, url);

          return true;
        }
      }

      // 只有X轴有值
      else if (xAxis && xVarIndex !== null) {
        if (coordParts[xVarIndex] === xValue) {
          // eslint-disable-next-line no-console
          console.log(`[${debugId}] 找到匹配的图片URL(仅X轴):`, url);

          return true;
        }
      }

      // 只有Y轴有值
      else if (yAxis && yVarIndex !== null) {
        if (coordParts[yVarIndex] === yValue) {
          // eslint-disable-next-line no-console
          console.log(`[${debugId}] 找到匹配的图片URL(仅Y轴):`, url);

          return true;
        }
      }

      return false;
    },
    [xAxis, yAxis]
  );

  // 获取回退的图片URL（当找不到匹配时使用）
  const getFallbackImageUrl = useCallback(
    (debugId: string): string | null => {
      if (!matrixData || Object.keys(matrixData.coordinates).length === 0) {
        return null;
      }

      const firstUrl = Object.values(matrixData.coordinates)[0];

      if (firstUrl) {
        // eslint-disable-next-line no-console
        console.log(`[${debugId}] 未找到匹配的图片，返回第一个图片URL:`, firstUrl);

        return firstUrl;
      }

      return null;
    },
    [matrixData]
  );

  // 查找匹配的图片URL
  const findMatchingUrls = useCallback(
    (xValue: string, yValue: string, debugId: string): string[] => {
      if (!matrixData) return [];

      // 获取变量索引
      const xVarIndex = xAxis ? parseInt(xAxis.substring(1)) : null; // 例如，从 'v0' 提取 0
      const yVarIndex = yAxis ? parseInt(yAxis.substring(1)) : null; // 例如，从 'v1' 提取 1

      // 存储匹配的图片URL
      const matchingUrls: string[] = [];

      // 从坐标映射中查找匹配的图片URL
      if (Object.keys(matrixData.coordinates).length > 0) {
        // eslint-disable-next-line no-console
        console.log(`[${debugId}] 从坐标映射中查找匹配的图片`);

        // 遍历所有坐标映射
        for (const [coordKey, url] of Object.entries(matrixData.coordinates)) {
          // 将坐标字符串分解为数组
          const coordParts = coordKey.split(",");

          if (isCoordinateMatch(coordParts, xVarIndex, yVarIndex, xValue, yValue, debugId, url)) {
            matchingUrls.push(url);
          }
        }
      }

      return matchingUrls;
    },
    [matrixData, xAxis, yAxis, isCoordinateMatch]
  );

  // 获取图片URL - 基于六维空间坐标
  const getImageUrl = useCallback(
    (xValue: string, yValue: string) => {
      if (!matrixData || !task) {
        // eslint-disable-next-line no-console
        console.log("没有矩阵数据或任务数据");

        return null;
      }

      // 为调试添加唯一ID
      const debugId = Math.random().toString(36).substring(2, 8);

      // eslint-disable-next-line no-console
      console.log(`[${debugId}] 尝试获取 [${xValue}][${yValue}] 的图片URL`);

      // 尝试查找匹配的URL
      const matchingUrls = findMatchingUrls(xValue, yValue, debugId);

      // 如果找到了匹配的URL，返回第一个
      if (matchingUrls.length > 0) {
        // eslint-disable-next-line no-console
        console.log(`[${debugId}] 找到 ${matchingUrls.length} 个匹配的图片URL`);

        return matchingUrls[0];
      }

      // 如果所有方法都失败，尝试返回第一个图片URL
      const firstUrl = getFallbackImageUrl(debugId);

      if (firstUrl) {
        return firstUrl;
      }

      // eslint-disable-next-line no-console
      console.log(`[${debugId}] 未找到 [${xValue}][${yValue}] 的图片URL`);

      return null;
    },
    [matrixData, task, findMatchingUrls, getFallbackImageUrl]
  );

  // 获取所有匹配的图片URL - 用于显示同一参数组合下的多个batch图片
  const getAllMatchingImageUrls = useCallback(
    (xValue: string, yValue: string): string[] => {
      if (!matrixData || !task) {
        return [];
      }

      // 直接使用之前创建的findMatchingUrls函数
      // 生成一个调试ID，但这里实际上不用于调试输出
      const debugId = Math.random().toString(36).substring(2, 8);

      return findMatchingUrls(xValue, yValue, debugId);
    },
    [matrixData, task, findMatchingUrls]
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

  // 获取单个坐标的缓存键
  const getSingleCacheKey = useCallback(
    (colValue: string, rowValue: string): string => {
      if (xAxis && yAxis) {
        return `${colValue}:${rowValue}`;
      } else if (xAxis) {
        return `${colValue}:`;
      } else if (yAxis) {
        return `:${rowValue}`;
      }

      return "";
    },
    [xAxis, yAxis]
  );

  // 获取单个坐标的图片URL
  const getSingleImageUrl = useCallback(
    (colValue: string, rowValue: string): string | null => {
      if (xAxis && yAxis) {
        return getImageUrl(colValue, rowValue);
      } else if (xAxis) {
        return getImageUrl(colValue, "");
      } else if (yAxis) {
        return getImageUrl("", rowValue);
      }

      return null;
    },
    [xAxis, yAxis, getImageUrl]
  );

  // 预先缓存图片URL
  const cacheImageUrls = useCallback(
    (rowValues: string[], columnValues: string[]): Record<string, string | null> => {
      const imageUrlCache: Record<string, string | null> = {};

      // 预先计算所有可能的组合
      for (const rowValue of rowValues) {
        for (const colValue of columnValues) {
          const cacheKey = getSingleCacheKey(colValue, rowValue);

          if (cacheKey && !imageUrlCache[cacheKey]) {
            // 使用getImageUrl函数查找图片URL
            const imageUrl = getSingleImageUrl(colValue, rowValue);

            if (imageUrl) {
              imageUrlCache[cacheKey] = imageUrl;
            }
          }
        }
      }

      return imageUrlCache;
    },
    [getSingleCacheKey, getSingleImageUrl]
  );

  // 获取缓存键
  const getCacheKey = useCallback(
    (colValue: string, rowValue: string): string => {
      if (xAxis && yAxis) {
        return `${colValue}:${rowValue}`;
      } else if (xAxis) {
        return `${colValue}:`;
      } else if (yAxis) {
        return `:${rowValue}`;
      }

      return "";
    },
    [xAxis, yAxis]
  );

  // 获取特定坐标的URL
  const getUrlForCoordinates = useCallback(
    (colValue: string, rowValue: string): string | null => {
      if (xAxis && yAxis) {
        return getImageUrl(colValue, rowValue);
      } else if (xAxis) {
        return getImageUrl(colValue, "");
      } else if (yAxis) {
        return getImageUrl("", rowValue);
      }

      return null;
    },
    [getImageUrl, xAxis, yAxis]
  );

  // 从缓存或直接获取图片URL
  const getImageUrlForCell = useCallback(
    (
      colValue: string,
      rowValue: string,
      cacheKey: string,
      imageUrlCache: Record<string, string | null>
    ): string | null => {
      // 从缓存中获取URL
      if (cacheKey && imageUrlCache[cacheKey]) {
        return imageUrlCache[cacheKey];
      }

      // 如果缓存中没有，尝试直接获取
      if (xAxis && yAxis) {
        return getImageUrl(colValue, rowValue);
      } else if (xAxis && colValue) {
        return getImageUrl(colValue, "");
      } else if (yAxis && rowValue) {
        return getImageUrl("", rowValue);
      }

      return null;
    },
    [xAxis, yAxis, getImageUrl]
  );

  // 获取所有匹配的URL
  const getMatchingUrlsForCell = useCallback(
    (colValue: string, rowValue: string): string[] => {
      if (xAxis && yAxis) {
        return getAllMatchingImageUrls(colValue, rowValue);
      } else if (xAxis) {
        return getAllMatchingImageUrls(colValue, "");
      } else if (yAxis) {
        return getAllMatchingImageUrls("", rowValue);
      }

      return [];
    },
    [xAxis, yAxis, getAllMatchingImageUrls]
  );

  // 创建表格单元格数据
  const createCellData = useCallback(
    (
      originalColValue: string,
      originalRowValue: string,
      imageUrlCache: Record<string, string | null>
    ): TableCellData | null => {
      // 获取缓存键
      const cacheKey = getCacheKey(originalColValue, originalRowValue);

      // 获取图片URL
      const imageUrl = getImageUrlForCell(
        originalColValue,
        originalRowValue,
        cacheKey,
        imageUrlCache
      );

      // 获取所有匹配的URL
      const matchingUrls = getMatchingUrlsForCell(originalColValue, originalRowValue);

      // 如果找到URL，创建单元格对象
      if (imageUrl || matchingUrls.length > 0) {
        return {
          url: imageUrl || matchingUrls[0], // 使用第一个URL作为主图片
          urls: matchingUrls.length > 0 ? matchingUrls : imageUrl ? [imageUrl] : [], // 存储所有匹配的URL
          xValue: originalColValue || "",
          yValue: originalRowValue || "",
          coordinates: {},
        };
      }

      // 没有找到URL
      return null;
    },
    [getCacheKey, getImageUrlForCell, getMatchingUrlsForCell]
  );

  // 获取X轴和Y轴的值
  const getAxisValues = useCallback(
    (debugId: string): { columnValues: string[]; rowValues: string[] } => {
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

      // eslint-disable-next-line no-console
      console.log(`[${debugId}] 原始列值:`, columnValues);
      // eslint-disable-next-line no-console
      console.log(`[${debugId}] 原始行值:`, rowValues);

      return { columnValues, rowValues };
    },
    [task, xAxis, yAxis]
  );

  // 记录处理后的值（用于调试）
  const logProcessedValues = useCallback(
    (debugId: string, processedColumnValues: string[], processedRowValues: string[]) => {
      // eslint-disable-next-line no-console
      console.log(`[${debugId}] 处理后的列值:`, processedColumnValues);
      // eslint-disable-next-line no-console
      console.log(`[${debugId}] 处理后的行值:`, processedRowValues);
    },
    []
  );

  // 创建表格行数据
  const createTableRows = useCallback(
    (
      processedRowValues: string[],
      processedColumnValues: string[],
      rowValueMap: Record<string, string>,
      columnValueMap: Record<string, string>,
      imageUrlCache: Record<string, string | null>,
      debugId: string
    ): TableRowData[] => {
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

          if (cellData) {
            rowData[processedColValue] = cellData;
          } else {
            rowData[processedColValue] = null;
            // eslint-disable-next-line no-console
            console.log(
              `[${debugId}] 没有为 [${originalColValue || ""}][${originalRowValue || ""}] 找到URL`
            );
          }
        });

        return rowData;
      });
    },
    [createCellData]
  );

  // 生成表格数据
  const generateTableData = useCallback((): TableRowData[] => {
    const debugId = Math.random().toString(36).substring(2, 8);

    if (!task) {
      // eslint-disable-next-line no-console
      console.error("无法生成表格数据：任务对象不存在");

      return [];
    }

    // 获取行列值
    const { columnValues, rowValues } = getAxisValues(debugId);

    // 处理列值和行值中有重名的情况
    const [processedColumnValues, columnValueMap] = processVariableValues(columnValues);
    const [processedRowValues, rowValueMap] = processVariableValues(rowValues);

    // 记录处理后的值
    logProcessedValues(debugId, processedColumnValues, processedRowValues);

    // 预先缓存图片URL
    const imageUrlCache = cacheImageUrls(rowValues, columnValues);

    // eslint-disable-next-line no-console
    console.log(`[${debugId}] 图片URL缓存:`, imageUrlCache);

    // 为每行创建表格数据
    return createTableRows(
      processedRowValues,
      processedColumnValues,

      rowValueMap,
      columnValueMap,
      imageUrlCache,
      debugId
    );
  }, [
    task,
    processVariableValues,
    cacheImageUrls,
    createTableRows,
    getAxisValues,
    logProcessedValues,
  ]);

  // 计算表格数据
  const tableData = useMemo<TableRowData[]>(() => generateTableData(), [generateTableData]);

  // 打印表格验证标题
  const logValidationHeader = useCallback(() => {
    // eslint-disable-next-line no-console
    console.log("===== 表格数据验证 =====");
  }, []);

  // 记录变量信息
  const logVariableInfo = useCallback(() => {
    // eslint-disable-next-line no-console
    console.log("变量信息:");
    // eslint-disable-next-line no-console
    console.log("X轴:", xAxis, variableNames[xAxis || ""]);
    // eslint-disable-next-line no-console
    console.log("Y轴:", yAxis, variableNames[yAxis || ""]);

    // 获取轴值
    const result = getAxisValues(Math.random().toString(36).substring(2, 8));

    return result;
  }, [xAxis, yAxis, variableNames, getAxisValues]);

  // 打印表格验证结束分隔线
  const logValidationFooter = useCallback(() => {
    // eslint-disable-next-line no-console
    console.log("---------------------------");
  }, []);

  // 验证单元格URL
  const validateCellUrls = useCallback(
    (columnValues: string[], rowValues: string[]) => {
      let totalCells = 0;
      let foundUrls = 0;

      for (const rowValue of rowValues) {
        for (const colValue of columnValues) {
          totalCells++;
          const url = getUrlForCoordinates(colValue, rowValue);

          if (url) {
            foundUrls++;
            // eslint-disable-next-line no-console
            console.log(`单元格[${rowValue || ""}][${colValue || ""}] 找到URL:`, url);
          } else {
            // eslint-disable-next-line no-console
            console.log(`单元格[${rowValue || ""}][${colValue || ""}] 未找到URL`);
          }
        }
      }

      // eslint-disable-next-line no-console
      console.log(`总单元格: ${totalCells}, 找到URL的: ${foundUrls}`);
    },
    [getUrlForCoordinates]
  );

  // 记录results.raw数据结构
  const logResultsRawStructure = useCallback(() => {
    if (task.results && task.results.raw) {
      // eslint-disable-next-line no-console
      console.log("results.raw 结构:", Object.keys(task.results.raw));
    } else {
      // eslint-disable-next-line no-console
      console.log("无 results.raw 数据");
    }
  }, [task.results]);

  // 记录results.matrix数据结构
  const logResultsMatrixStructure = useCallback(() => {
    if (task.results && task.results.matrix) {
      // eslint-disable-next-line no-console
      console.log("results.matrix 结构:", Object.keys(task.results.matrix));
    } else {
      // eslint-disable-next-line no-console
      console.log("无 results.matrix 数据");
    }
  }, [task.results]);

  // 分析dramatiq_tasks字段
  const analyzeDramatiqTasks = useCallback(() => {
    if (!task.dramatiq_tasks || task.dramatiq_tasks.length === 0) {
      return {};
    }

    const stats: Record<string, number> = {};

    // 统计v0-v5字段的出现次数
    task.dramatiq_tasks.forEach((dtask) => {
      for (let i = 0; i <= 5; i++) {
        const key = `v${i}`;

        if (key in dtask) {
          stats[key] = (stats[key] || 0) + 1;
        }
      }
    });

    return stats;
  }, [task.dramatiq_tasks]);

  // 记录dramatiq_tasks数据结构
  const logDramatiqTasksStructure = useCallback(() => {
    if (task.dramatiq_tasks && task.dramatiq_tasks.length > 0) {
      // eslint-disable-next-line no-console
      console.log("dramatiq_tasks 第一个条目结构:", task.dramatiq_tasks[0]);

      // 分析v0-v5字段的分布
      const vFieldStats = analyzeDramatiqTasks();

      // eslint-disable-next-line no-console
      console.log("dramatiq_tasks v0-v5字段统计:", vFieldStats);
    }
  }, [analyzeDramatiqTasks, task.dramatiq_tasks]);

  // 记录任务数据结构
  const logTaskDataStructure = useCallback(() => {
    // eslint-disable-next-line no-console
    console.log("数据结构分析:");

    // 记录results.raw数据结构
    logResultsRawStructure();

    // 记录results.matrix数据结构
    logResultsMatrixStructure();

    // 记录dramatiq_tasks数据结构
    logDramatiqTasksStructure();
  }, [logResultsRawStructure, logResultsMatrixStructure, logDramatiqTasksStructure]);

  // 记录表格数据验证信息
  const logTableDataValidation = useCallback(() => {
    // 打印表格验证标题
    logValidationHeader();

    // 获取并记录变量信息
    const { columnValues, rowValues } = logVariableInfo();

    // 记录任务数据结构
    logTaskDataStructure();

    // 验证单元格URL
    validateCellUrls(columnValues, rowValues);

    // 打印表格验证结束分隔线
    logValidationFooter();
  }, [
    logValidationHeader,
    logVariableInfo,
    logTaskDataStructure,
    validateCellUrls,
    logValidationFooter,
  ]);

  // 添加调试代码，验证数据获取和渲染
  useEffect(() => {
    if (tableData && tableData.length > 0) {
      logTableDataValidation();
    } else {
      // eslint-disable-next-line no-console
      console.log("tableData为空，无法渲染表格");
    }
  }, [tableData, logTableDataValidation]);

  // 处理全屏模式切换
  const toggleFullscreen = () => {
    if (!fullscreenElement) return;

    if (!document.fullscreenElement) {
      fullscreenElement
        .requestFullscreen()
        .then(() => {
          setIsFullscreen(true);
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          // eslint-disable-next-line no-console
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
          // eslint-disable-next-line no-console
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
  }, [setIsFullscreen]);

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
          <div className="flex">
            <Icon className="w-5 h-5 mr-2" icon="heroicons:exclamation-circle" />
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">{task.task_name || `任务 ID: ${task.id}`}</h2>
        <p className="text-sm text-default-500">
          创建时间: {new Date(task.created_at).toLocaleString()}
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
                    // eslint-disable-next-line no-console
                    // eslint-disable-next-line no-console
                    // eslint-disable-next-line no-console
                    console.log("手动刷新表格数据");
                    const tempX = xAxis;

                    setXAxis("");
                    setTimeout(() => setXAxis(tempX), 50);
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
          <CardHeader className="flex justify-between items-center">
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
          </CardHeader>
          <CardBody>
            <div
              ref={(el) => setFullscreenElement(el)}
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
                            {colKey}
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
                        {row.rowTitle}
                      </td>
                      {Object.keys(row)
                        .filter((key) => key !== "key" && key !== "rowTitle")
                        .map((colKey, colIndex) => {
                          const cell = row[colKey] as TableCellData | null;
                          const imageUrl = cell?.url;
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
                              {imageUrl ? (
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
                                                // eslint-disable-next-line no-console
                                                // eslint-disable-next-line no-console
                                                console.log("图片加载失败:", url);
                                                const imgElements = document.querySelectorAll(
                                                  `img[src="${getResizedImageUrl(url, getImageSizeByBatchCount(cell.urls?.length || 1))}"]`
                                                );

                                                imgElements.forEach((img) => {
                                                  img.setAttribute("src", PLACEHOLDER_IMAGE_URL);
                                                });
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
                                          src={getResizedImageUrl(imageUrl, 180)}
                                          style={{
                                            objectFit: "none",
                                            width: "auto",
                                            height: "auto",
                                          }}
                                          width="auto"
                                          onError={() => {
                                            // eslint-disable-next-line no-console
                                            // eslint-disable-next-line no-console
                                            console.log("图片加载失败:", imageUrl);
                                            const imgElements = document.querySelectorAll(
                                              `img[src="${getResizedImageUrl(imageUrl, 180)}"]`
                                            );

                                            imgElements.forEach((img) => {
                                              img.setAttribute("src", PLACEHOLDER_IMAGE_URL);
                                            });
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
                                      <p className="text-default-400 text-sm">未找到图片</p>
                                      {xAxis && (
                                        <p className="text-default-300 text-xs mt-2">{`${xAxis}:${(cell as TableCellData)?.xValue || colKey.replace(/#\d+$/, "")}`}</p>
                                      )}
                                      {yAxis && (
                                        <p className="text-default-300 text-xs mt-1">{`${yAxis}:${(cell as TableCellData)?.yValue || row.rowTitle.replace(/#\d+$/, "")}`}</p>
                                      )}
                                    </div>
                                  </div>
                                  <span className="text-xs text-default-400 mt-1">无数据</span>
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
                      src={currentImageUrl} // 使用原始URL，不添加缩放参数
                      style={{ maxHeight: "70vh", objectFit: "contain" }}
                      width="auto"
                      onError={() => {
                        // eslint-disable-next-line no-console
                        // eslint-disable-next-line no-console
                        // eslint-disable-next-line no-console
                        console.log("大图加载失败:", currentImageUrl);
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
                            src={getResizedImageUrl(
                              url,
                              getImageSizeByBatchCount(currentImageUrls.length)
                            )}
                            style={{ objectFit: "contain" }}
                            width="auto"
                            onError={() => {
                              // eslint-disable-next-line no-console
                              // eslint-disable-next-line no-console
                              // eslint-disable-next-line no-console
                              console.log("网格图片加载失败:", url);
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
