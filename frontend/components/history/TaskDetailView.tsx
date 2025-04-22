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
    Spinner
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { TaskDetail } from "@/types/task";
import { getTaskMatrix } from "@/utils/taskService";

// 占位图片URL
const PLACEHOLDER_IMAGE_URL = "/placeholder-image.png";

interface TaskDetailViewProps {
    task: TaskDetail;
}

interface TableCellData {
    url: string;
    urls?: string[];  // 所有匹配的URL，用于显示同一参数组合下的多个batch图片
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

export const TaskDetailView: React.FC<TaskDetailViewProps> = ({ task }) => {
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

    // 矩阵数据 - 从后端获取的六维空间坐标系统
    const [matrixData, setMatrixData] = useState<MatrixData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // 查看单张图片函数（在当前页面显示模态框）
    const viewImageInModal = (imageUrl: string, title: string = "") => {
        setCurrentImageUrl(imageUrl);
        setCurrentImageTitle(title);
        setCurrentImageUrls([imageUrl]);
        setIsGridView(false);
        setIsImageModalOpen(true);
    };



    // 获取图片的多维坐标信息
    const getCoordinateInfo = (imageUrl: string): string => {
        if (!matrixData || !imageUrl) {
            return "无坐标信息";
        }

        // 查找图片在坐标映射中的数据
        const coordKey = Object.entries(matrixData.coordinates).find(([_, url]) => url === imageUrl)?.[0];
        if (!coordKey) {
            return "无坐标信息";
        }

        // 将坐标字符串分解为数组，例如 "0,1,,2,," => ["0", "1", "", "2", "", ""]
        const coordParts = coordKey.split(',');

        // 构建坐标信息
        const coordInfo = coordParts
            .map((value, index) => {
                if (value === "") return null; // 跳过空坐标

                const varKey = `v${index}`;
                const varName = variableNames[varKey] || varKey;

                // 尝试获取该维度的实际值而不仅是索引
                const varInfo = matrixData.variables[varKey];
                let displayValue: string | number = value;

                if (varInfo && typeof varInfo === 'object' && 'values' in varInfo && Array.isArray(varInfo.values)) {
                    const idx = parseInt(value);
                    if (!isNaN(idx) && idx >= 0 && idx < varInfo.values.length && varInfo.values[idx] && 'value' in varInfo.values[idx]) {
                        displayValue = `${varInfo.values[idx].value}(${idx})`;
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
        if (imageCount <= 1) return 'grid-cols-1';
        if (imageCount <= 4) return 'grid-cols-2';
        if (imageCount <= 9) return 'grid-cols-3';
        if (imageCount <= 16) return 'grid-cols-4';
        return 'grid-cols-5'; // 如果超过16张，使用5列
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
                throw new Error(response.error || '获取矩阵数据失败');
            }

            // 设置矩阵数据
            setMatrixData(response.data);

            // 提取变量名称和可用变量
            const variables: string[] = [];
            const varNames: Record<string, string> = {};

            if (response.data.variables) {
                Object.entries(response.data.variables).forEach(([key, value]) => {
                    // 只添加name不为空的变量
                    if (key.startsWith('v') && value && typeof value === 'object' && 'name' in value && value.name !== "") {
                        varNames[key] = value.name as string || key;
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
            console.error('Error fetching matrix data:', err);
            setError('获取矩阵数据失败，请刷新页面重试');
        } finally {
            setIsLoading(false);
        }
    }, [task]);

    // 当任务变化时，获取矩阵数据
    useEffect(() => {
        fetchMatrixData();
    }, [fetchMatrixData]);

    // 获取图片URL - 基于六维空间坐标
    const getImageUrl = (xValue: string, yValue: string) => {
        if (!matrixData || !task) {
            console.log('没有矩阵数据或任务数据');
            return null;
        }

        // 为调试添加唯一ID
        const debugId = Math.random().toString(36).substring(2, 8);
        console.log(`[${debugId}] 尝试获取 [${xValue}][${yValue}] 的图片URL`);

        // 获取变量索引
        const xVarIndex = xAxis ? parseInt(xAxis.substring(1)) : null; // 例如，从 'v0' 提取 0
        const yVarIndex = yAxis ? parseInt(yAxis.substring(1)) : null; // 例如，从 'v1' 提取 1

        // 存储匹配的图片URL
        const matchingUrls: string[] = [];

        // 从坐标映射中查找匹配的图片URL
        if (Object.keys(matrixData.coordinates).length > 0) {
            console.log(`[${debugId}] 从坐标映射中查找匹配的图片`);

            // 遍历所有坐标映射
            for (const [coordKey, url] of Object.entries(matrixData.coordinates)) {
                // 将坐标字符串分解为数组，例如 "值1,值2,,值4,," => ["值1", "值2", "", "值4", "", ""]
                const coordParts = coordKey.split(',');

                // 根据选择的轴决定查找策略
                if (xAxis && yAxis && xVarIndex !== null && yVarIndex !== null) {
                    // 两个轴都有值
                    if (coordParts[xVarIndex] === xValue && coordParts[yVarIndex] === yValue) {
                        console.log(`[${debugId}] 找到匹配的图片URL(双轴):`, url);
                        matchingUrls.push(url);
                    }
                } else if (xAxis && xVarIndex !== null) {
                    // 只有X轴有值
                    if (coordParts[xVarIndex] === xValue) {
                        console.log(`[${debugId}] 找到匹配的图片URL(仅X轴):`, url);
                        matchingUrls.push(url);
                    }
                } else if (yAxis && yVarIndex !== null) {
                    // 只有Y轴有值
                    if (coordParts[yVarIndex] === yValue) {
                        console.log(`[${debugId}] 找到匹配的图片URL(仅Y轴):`, url);
                        matchingUrls.push(url);
                    }
                }
            }
        }

        // 如果找到了匹配的URL，返回第一个
        if (matchingUrls.length > 0) {
            console.log(`[${debugId}] 找到 ${matchingUrls.length} 个匹配的图片URL`);
            // 如果有多个匹配的URL，返回第一个
            // 注意：这里可以扩展为返回所有匹配的URL，但需要修改返回类型和调用代码
            return matchingUrls[0];
        }

        // 如果所有方法都失败，尝试返回第一个图片URL
        if (Object.keys(matrixData.coordinates).length > 0) {
            const firstUrl = Object.values(matrixData.coordinates)[0];
            if (firstUrl) {
                console.log(`[${debugId}] 未找到匹配的图片，返回第一个图片URL:`, firstUrl);
                return firstUrl;
            }
        }

        console.log(`[${debugId}] 未找到 [${xValue}][${yValue}] 的图片URL`);
        return null;
    };

    // 获取所有匹配的图片URL - 用于显示同一参数组合下的多个batch图片
    const getAllMatchingImageUrls = (xValue: string, yValue: string): string[] => {
        if (!matrixData || !task) {
            return [];
        }

        // 获取变量索引
        const xVarIndex = xAxis ? parseInt(xAxis.substring(1)) : null;
        const yVarIndex = yAxis ? parseInt(yAxis.substring(1)) : null;

        // 存储匹配的图片URL
        const matchingUrls: string[] = [];

        // 从坐标映射中查找匹配的图片URL
        if (Object.keys(matrixData.coordinates).length > 0) {
            // 遍历所有坐标映射
            for (const [coordKey, url] of Object.entries(matrixData.coordinates)) {
                const coordParts = coordKey.split(',');

                // 根据选择的轴决定查找策略
                if (xAxis && yAxis && xVarIndex !== null && yVarIndex !== null) {
                    // 两个轴都有值
                    if (coordParts[xVarIndex] === xValue && coordParts[yVarIndex] === yValue) {
                        matchingUrls.push(url);
                    }
                } else if (xAxis && xVarIndex !== null) {
                    // 只有X轴有值
                    if (coordParts[xVarIndex] === xValue) {
                        matchingUrls.push(url);
                    }
                } else if (yAxis && yVarIndex !== null) {
                    // 只有Y轴有值
                    if (coordParts[yVarIndex] === yValue) {
                        matchingUrls.push(url);
                    }
                }
            }
        }

        return matchingUrls;
    };

    // 生成表格数据
    const generateTableData = useCallback((): TableRowData[] => {
        // 为调试添加唯一ID
        const debugId = Math.random().toString(36).substring(2, 8);

        if (!task) {
            console.error("无法生成表格数据：任务对象不存在");
            return [];
        }

        // 初始化变量
        let columnValues: string[] = [''];
        let rowValues: string[] = [''];

        // 获取选中的变量数据
        const xAxisVar = xAxis ? task.variables[xAxis as keyof typeof task.variables] : null;
        const yAxisVar = yAxis ? task.variables[yAxis as keyof typeof task.variables] : null;

        // 获取变量值
        if (xAxisVar?.values) {
            columnValues = xAxisVar.values.map((val: any) => val.value || '');
        }

        if (yAxisVar?.values) {
            rowValues = yAxisVar.values.map((val: any) => val.value || '');
        }

        console.log(`[${debugId}] 原始列值:`, columnValues);
        console.log(`[${debugId}] 原始行值:`, rowValues);

        // 处理列值中有重名的情况
        const processedColumnValues: string[] = [];
        const columnValueCounts: Record<string, number> = {};

        columnValues.forEach((value) => {
            if (value in columnValueCounts) {
                columnValueCounts[value]++;
                processedColumnValues.push(`${value}#${columnValueCounts[value]}`);
            } else {
                columnValueCounts[value] = 0;
                processedColumnValues.push(value);
            }
        });

        // 处理行值中有重名的情况
        const processedRowValues: string[] = [];
        const rowValueCounts: Record<string, number> = {};

        rowValues.forEach((value) => {
            if (value in rowValueCounts) {
                rowValueCounts[value]++;
                processedRowValues.push(`${value}#${rowValueCounts[value]}`);
            } else {
                rowValueCounts[value] = 0;
                processedRowValues.push(value);
            }
        });

        // 创建原始值和处理后值的映射
        const columnValueMap: Record<string, string> = {};
        columnValues.forEach((originalValue, index) => {
            columnValueMap[processedColumnValues[index]] = originalValue;
        });

        const rowValueMap: Record<string, string> = {};
        rowValues.forEach((originalValue, index) => {
            rowValueMap[processedRowValues[index]] = originalValue;
        });

        console.log(`[${debugId}] 处理后的列值:`, processedColumnValues);
        console.log(`[${debugId}] 处理后的行值:`, processedRowValues);

        // 预先获取所有可能的图片URL组合
        const imageUrlCache: Record<string, string | null> = {};

        // 预先获取变量索引
        const xVarIndex = xAxis ? parseInt(xAxis.substring(1)) : null; // 例如，从 'v0' 提取 0
        const yVarIndex = yAxis ? parseInt(yAxis.substring(1)) : null; // 例如，从 'v1' 提取 1

        // 预先建立变量值和索引的映射
        const xValueToIndexMap: Record<string, number[]> = {};
        const yValueToIndexMap: Record<string, number[]> = {};

        if (xAxisVar?.values) {
            xAxisVar.values.forEach((v: any, idx: number) => {
                if (!xValueToIndexMap[v.value]) {
                    xValueToIndexMap[v.value] = [];
                }
                xValueToIndexMap[v.value].push(idx);
            });
        }

        if (yAxisVar?.values) {
            yAxisVar.values.forEach((v: any, idx: number) => {
                if (!yValueToIndexMap[v.value]) {
                    yValueToIndexMap[v.value] = [];
                }
                yValueToIndexMap[v.value].push(idx);
            });
        }

        console.log(`[${debugId}] X值到索引映射:`, xValueToIndexMap);
        console.log(`[${debugId}] Y值到索引映射:`, yValueToIndexMap);

        // 使用多维坐标系统构建图片映射
        const coordToUrlMap: Record<string, string> = {};

        // 如果有矩阵数据，直接使用
        if (matrixData && matrixData.coordinates) {
            // 所有映射都已经在matrixData.coordinates中
            console.log(`[${debugId}] 直接使用矩阵数据中的坐标映射`);
        }
        // 否则尝试使用旧的方法构建映射
        else if (task.dramatiq_tasks && task.dramatiq_tasks.length > 0) {
            task.dramatiq_tasks.forEach(subtask => {
                if (subtask.result && subtask.result.url) {
                    // 根据选择的轴构建坐标键
                    if (xAxis && yAxis && xVarIndex !== null && yVarIndex !== null) {
                        const xCoord = (subtask as any)[xAxis];
                        const yCoord = (subtask as any)[yAxis];

                        if (xCoord !== undefined && xCoord !== null &&
                            yCoord !== undefined && yCoord !== null) {
                            const coordKey = `${xAxis}_${xCoord}:${yAxis}_${yCoord}`;
                            coordToUrlMap[coordKey] = subtask.result.url;
                        }
                    } else if (xAxis && xVarIndex !== null) {
                        const xCoord = (subtask as any)[xAxis];

                        if (xCoord !== undefined && xCoord !== null) {
                            const coordKey = `${xAxis}_${xCoord}`;
                            coordToUrlMap[coordKey] = subtask.result.url;
                        }
                    } else if (yAxis && yVarIndex !== null) {
                        const yCoord = (subtask as any)[yAxis];

                        if (yCoord !== undefined && yCoord !== null) {
                            const coordKey = `${yAxis}_${yCoord}`;
                            coordToUrlMap[coordKey] = subtask.result.url;
                        }
                    }
                }
            });
        }

        console.log(`[${debugId}] 坐标到URL映射:`, coordToUrlMap);

        // 预先计算所有可能的组合
        for (const rowValue of rowValues) {
            for (const colValue of columnValues) {
                let cacheKey = '';
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
                        imageUrl = getImageUrl(colValue, '');
                    } else if (yAxis) {
                        imageUrl = getImageUrl('', rowValue);
                    }

                    if (imageUrl) {
                        imageUrlCache[cacheKey] = imageUrl;
                    }
                }
            }
        }

        console.log(`[${debugId}] 图片URL缓存:`, imageUrlCache);

        // 生成表格数据
        return processedRowValues.map((processedRowValue) => {
            const originalRowValue = rowValueMap[processedRowValue];
            const rowData: TableRowData = {
                key: processedRowValue,
                rowTitle: processedRowValue
            };

            // 为每个列值添加一个单元格
            processedColumnValues.forEach((processedColValue) => {
                const originalColValue = columnValueMap[processedColValue];

                // 从缓存中获取URL
                let imageUrl: string | null = null;
                let cacheKey = '';

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
                        imageUrl = getImageUrl(originalColValue, '');
                    } else if (yAxis && originalRowValue) {
                        imageUrl = getImageUrl('', originalRowValue);
                    }
                }

                // 获取所有匹配的URL
                let matchingUrls: string[] = [];
                if (xAxis && yAxis) {
                    matchingUrls = getAllMatchingImageUrls(originalColValue, originalRowValue);
                } else if (xAxis) {
                    matchingUrls = getAllMatchingImageUrls(originalColValue, '');
                } else if (yAxis) {
                    matchingUrls = getAllMatchingImageUrls('', originalRowValue);
                }

                // 如果找到URL，创建单元格对象
                if (imageUrl || matchingUrls.length > 0) {
                    rowData[processedColValue] = {
                        url: imageUrl || matchingUrls[0],  // 使用第一个URL作为主图片
                        urls: matchingUrls.length > 0 ? matchingUrls : (imageUrl ? [imageUrl] : []),  // 存储所有匹配的URL
                        xValue: originalColValue || '',
                        yValue: originalRowValue || '',
                        coordinates: {}
                    };
                } else {
                    // 没有找到URL，设置为null或空对象
                    rowData[processedColValue] = null;
                    console.log(`[${debugId}] 没有为 [${originalColValue || ''}][${originalRowValue || ''}] 找到URL`);
                }
            });

            return rowData;
        });
    }, [task, xAxis, yAxis, getImageUrl, matrixData]);

    // 计算表格数据
    const tableData = useMemo<TableRowData[]>(() => generateTableData(), [generateTableData]);

    // 添加调试代码，验证数据获取和渲染
    useEffect(() => {
        if (tableData && tableData.length > 0) {
            console.log('--------- 表格数据验证 ---------');
            console.log('可用变量:', availableVariables);
            console.log('过滤后的变量名:', variableNames);

            // 获取表格中实际显示的X和Y值
            const xAxisVar = xAxis ? task.variables[xAxis as keyof typeof task.variables] : null;
            const yAxisVar = yAxis ? task.variables[yAxis as keyof typeof task.variables] : null;

            const columnValues = xAxisVar?.values?.map((val: any) => val.value) || [''];
            const rowValues = yAxisVar?.values?.map((val: any) => val.value) || [''];

            console.log('X轴变量:', xAxis, '值:', columnValues);
            console.log('Y轴变量:', yAxis, '值:', rowValues);

            // 输出数据结构信息
            console.log('数据结构分析:');
            if (task.results?.raw) {
                console.log('results.raw 键名格式:', Object.keys(task.results.raw));
                const firstRawKey = Object.keys(task.results.raw)[0];
                if (firstRawKey) {
                    console.log('results.raw 第一个条目结构:', task.results.raw[firstRawKey]);
                }
            }

            if (task.results?.matrix) {
                console.log('results.matrix 结构:', task.results.matrix);
            }

            if (task.dramatiq_tasks && task.dramatiq_tasks.length > 0) {
                console.log('dramatiq_tasks 第一个条目结构:', task.dramatiq_tasks[0]);

                // 分析v0-v5字段的分布
                const vFieldStats: Record<string, number> = {};
                task.dramatiq_tasks.forEach(subtask => {
                    for (let i = 0; i <= 5; i++) {
                        const field = `v${i}`;
                        if ((subtask as any)[field] !== undefined && (subtask as any)[field] !== null) {
                            vFieldStats[field] = (vFieldStats[field] || 0) + 1;
                        }
                    }
                });
                console.log('dramatiq_tasks v0-v5字段统计:', vFieldStats);
            }

            // 验证所有单元格URL
            let totalCells = 0;
            let foundUrls = 0;

            for (const rowValue of rowValues) {
                for (const colValue of columnValues) {
                    totalCells++;
                    let url = null;
                    if (xAxis && yAxis) {
                        url = getImageUrl(colValue, rowValue);
                    } else if (xAxis) {
                        url = getImageUrl(colValue, '');
                    } else if (yAxis) {
                        url = getImageUrl('', rowValue);
                    }

                    if (url) {
                        foundUrls++;
                        console.log(`单元格[${rowValue || ''}][${colValue || ''}] 找到URL:`, url);
                    } else {
                        console.log(`单元格[${rowValue || ''}][${colValue || ''}] 未找到URL`);
                    }
                }
            }

            console.log(`总单元格: ${totalCells}, 找到URL的: ${foundUrls}`);
            console.log('---------------------------');
        } else {
            console.log('tableData为空，无法渲染表格');
        }
    }, [tableData, xAxis, yAxis, availableVariables, variableNames, task, getImageUrl, matrixData]);

    // 处理全屏模式切换
    const toggleFullscreen = () => {
        if (!fullscreenElement) return;

        if (!document.fullscreenElement) {
            fullscreenElement.requestFullscreen().then(() => {
                setIsFullscreen(true);
            }).catch(err => {
                console.error(`全屏请求失败: ${err.message}`);
            });
        } else {
            document.exitFullscreen().then(() => {
                setIsFullscreen(false);
            }).catch(err => {
                console.error(`退出全屏失败: ${err.message}`);
            });
        }
    };

    // 监听全屏状态变化
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
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
                    <div className="flex">
                        <Icon icon="heroicons:exclamation-circle" className="w-5 h-5 mr-2" />
                        <span>{error}</span>
                    </div>
                </div>
            )}

            <div className="mb-4">
                <h2 className="text-xl font-semibold mb-2">
                    {task.task_name || `任务 ID: ${task.id}`}
                </h2>
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
                                key={`x-axis-select-${xAxis || 'empty'}`}
                                label="X轴变量"
                                placeholder="选择X轴变量"
                                selectedKeys={xAxis ? [xAxis] : []}
                                className="w-full"
                                onSelectionChange={(keys) => {
                                    const keysArray = Array.from(keys);
                                    if (keysArray.length > 0) {
                                        const newXAxis = keysArray[0] as string;
                                        // 如果新选择的X轴与当前Y轴相同，则清空Y轴
                                        if (newXAxis === yAxis) {
                                            setYAxis("");
                                        }
                                        setXAxis(newXAxis);
                                        console.log('已选择X轴变量:', newXAxis);
                                    } else {
                                        setXAxis("");
                                        console.log('已清空X轴变量');
                                    }
                                }}
                            >
                                {availableVariables.map((variable) => (
                                    <SelectItem key={variable}>
                                        {`${variable}:${variableNames[variable] || ''}`}
                                    </SelectItem>
                                ))}
                            </Select>
                            <Select
                                key={`y-axis-select-${yAxis || 'empty'}`}
                                label="Y轴变量"
                                placeholder="选择Y轴变量"
                                selectedKeys={yAxis ? [yAxis] : []}
                                className="w-full"
                                onSelectionChange={(keys) => {
                                    const keysArray = Array.from(keys);
                                    if (keysArray.length > 0) {
                                        const newYAxis = keysArray[0] as string;
                                        // 如果新选择的Y轴与当前X轴相同，则清空X轴
                                        if (newYAxis === xAxis) {
                                            setXAxis("");
                                        }
                                        setYAxis(newYAxis);
                                        console.log('已选择Y轴变量:', newYAxis);
                                    } else {
                                        setYAxis("");
                                        console.log('已清空Y轴变量');
                                    }
                                }}
                            >
                                {availableVariables.map((variable) => (
                                    <SelectItem key={variable} className={variable === xAxis ? "opacity-50 pointer-events-none" : ""}>
                                        {`${variable}:${variableNames[variable] || ''}`}
                                    </SelectItem>
                                ))}
                            </Select>
                        </div>
                        <div className="flex justify-between items-center mt-4">
                            <div className="text-xs text-default-500">
                                <p>注：只有具有有效名称的变量会显示在选择器中</p>
                                <p>至少选择一个轴才能显示表格</p>
                                {Object.entries(task.variables || {}).some(([_, value]) =>
                                    typeof value === 'object' && 'name' in value && value.name === "") && (
                                        <p className="text-warning mt-1">当前任务中有未命名变量未显示</p>
                                    )}
                            </div>
                            {(xAxis || yAxis) && (
                                <Button
                                    size="sm"
                                    color="primary"
                                    variant="flat"
                                    onPress={() => {
                                        // 强制刷新表格数据
                                        console.log('手动刷新表格数据');
                                        const tempX = xAxis;
                                        setXAxis('');
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
                        <div className="text-center text-default-500">
                            此任务没有足够的变量来创建表格
                        </div>
                    </CardBody>
                </Card>
            )}

            {(xAxis || yAxis) && tableData && tableData.length > 0 && (
                <Card>
                    <CardHeader className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold">结果表格</h3>
                        <Button
                            size="sm"
                            variant="flat"
                            onPress={toggleFullscreen}
                            startContent={
                                <Icon icon={isFullscreen ? "solar:exit-bold-linear" : "solar:maximize-bold-linear"} width={18} />
                            }
                        >
                            {isFullscreen ? "退出全屏" : "全屏查看"}
                        </Button>
                    </CardHeader>
                    <CardBody>
                        <div
                            className={`overflow-x-auto ${isFullscreen ? 'fullscreen-table' : ''}`}
                            style={{ maxWidth: '100%', overflowX: 'scroll' }}
                            ref={(el) => setFullscreenElement(el)}
                        >
                            <table className="border-collapse"
                                style={{
                                    tableLayout: 'fixed',
                                    width: 'auto',
                                    borderSpacing: 0,
                                    borderCollapse: 'collapse',
                                    borderRadius: 0
                                }}
                            >
                                <thead>
                                    <tr>
                                        <th className="border p-1 bg-default-100 text-xs w-20" style={{ minWidth: '80px', borderRadius: 0 }}>
                                            {xAxis && yAxis
                                                ? `${xAxis}:${variableNames[xAxis] || ''} / ${yAxis}:${variableNames[yAxis] || ''}`
                                                : xAxis
                                                    ? `${xAxis}:${variableNames[xAxis] || ''}`
                                                    : yAxis
                                                        ? `${yAxis}:${variableNames[yAxis] || ''}`
                                                        : ''
                                            }
                                        </th>
                                        {/* 获取第一行的所有列键作为列头 */}
                                        {tableData.length > 0 && Object.keys(tableData[0])
                                            .filter(key => key !== 'key' && key !== 'rowTitle')
                                            .map((colKey, colIndex) => (
                                                <th key={`col-${colIndex}-${colKey}`} className="border p-1 bg-default-100 text-xs" style={{ width: '256px', minWidth: '256px', maxWidth: '256px', borderRadius: 0 }}>
                                                    {colKey}
                                                </th>
                                            ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableData.map((row: TableRowData, rowIndex: number) => (
                                        <tr key={`row-${rowIndex}-${row.key}`}>
                                            <td className="border p-1 font-medium bg-default-50 text-xs w-20" style={{ minWidth: '80px', borderRadius: 0 }}>
                                                {row.rowTitle}
                                            </td>
                                            {Object.keys(row)
                                                .filter(key => key !== 'key' && key !== 'rowTitle')
                                                .map((colKey, colIndex) => {
                                                    const cell = row[colKey] as (TableCellData | null);
                                                    const imageUrl = cell?.url;
                                                    const cellTitle = `${row.rowTitle}-${colKey}`;
                                                    return (
                                                        <td key={`cell-${rowIndex}-${colIndex}-${colKey}`} className="border p-2 text-center" style={{ width: '256px', height: '256px', minWidth: '256px', minHeight: '256px', maxWidth: '256px', borderRadius: 0 }}>
                                                            {imageUrl ? (
                                                                <div className="flex flex-col items-center">
                                                                    {/* 如果有多张图片，显示网格 */}
                                                                    {cell.urls && cell.urls.length > 1 ? (
                                                                        <div className={`grid gap-1 ${getGridColumns(cell.urls.length)} w-64 h-64 bg-default-50 overflow-hidden`}>
                                                                            {cell.urls.map((url, index) => (
                                                                                <div
                                                                                    key={index}
                                                                                    className="relative aspect-square overflow-hidden cursor-pointer"
                                                                                    onClick={() => viewImageInModal(url, `${cellTitle} - 批次 ${index + 1}`)}
                                                                                >
                                                                                    <Image
                                                                                        src={url}
                                                                                        alt={`${cellTitle} - 批次 ${index + 1}`}
                                                                                        width="100%"
                                                                                        height="100%"
                                                                                        radius="none"
                                                                                        className="object-cover"
                                                                                        onError={() => {
                                                                                            console.log('图片加载失败:', url);
                                                                                            const imgElements = document.querySelectorAll(`img[src="${url}"]`);
                                                                                            imgElements.forEach(img => {
                                                                                                img.setAttribute('src', PLACEHOLDER_IMAGE_URL);
                                                                                            });
                                                                                        }}
                                                                                    />
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <div
                                                                            className="w-64 h-64 flex items-center justify-center bg-default-50 overflow-hidden cursor-pointer"
                                                                            onClick={() => viewImageInModal(imageUrl, cellTitle)}
                                                                        >
                                                                            <Image
                                                                                src={imageUrl}
                                                                                alt={cellTitle}
                                                                                width={256}
                                                                                height={256}
                                                                                radius="none"
                                                                                className="max-w-full max-h-full object-contain"
                                                                                onError={() => {
                                                                                    console.log('图片加载失败:', imageUrl);
                                                                                    const imgElements = document.querySelectorAll('img[src="' + imageUrl + '"]');
                                                                                    imgElements.forEach(img => {
                                                                                        img.setAttribute('src', PLACEHOLDER_IMAGE_URL);
                                                                                    });
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col items-center">
                                                                    <div className="w-64 h-64 flex items-center justify-center bg-default-50 overflow-hidden mb-1">
                                                                        <div className="text-center p-4">
                                                                            <p className="text-default-400 text-sm">未找到图片</p>
                                                                            {xAxis && (
                                                                                <p className="text-default-300 text-xs mt-2">{`${xAxis}:${(cell as TableCellData)?.xValue || colKey.replace(/#\d+$/, '')}`}</p>
                                                                            )}
                                                                            {yAxis && (
                                                                                <p className="text-default-300 text-xs mt-1">{`${yAxis}:${(cell as TableCellData)?.yValue || row.rowTitle.replace(/#\d+$/, '')}`}</p>
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
                            <p className="text-default-400 text-sm">
                                可能原因：
                            </p>
                            <ul className="text-default-400 text-sm list-disc list-inside mt-2">
                                <li>所选变量没有对应的结果数据</li>
                                <li>任务结果格式不兼容</li>
                                <li>任务尚未完成所有子任务</li>
                            </ul>
                            <p className="text-default-400 text-sm mt-4">
                                请尝试选择其他变量组合或检查任务状态
                            </p>
                        </div>
                    </CardBody>
                </Card>
            )}

            {/* 图片查看模态框 */}
            <Modal
                isOpen={isImageModalOpen}
                onClose={() => setIsImageModalOpen(false)}
                size="5xl"
            >
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
                                    {currentImageUrls.length > 1 && (
                                        <Button
                                            size="sm"
                                            variant="flat"
                                            color="primary"
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
                                            src={currentImageUrl}
                                            alt={currentImageTitle}
                                            width="100%"
                                            height="auto"
                                            className="max-w-full max-h-full object-contain"
                                            style={{ maxHeight: "70vh" }}
                                            onError={() => {
                                                console.log('大图加载失败:', currentImageUrl);
                                            }}
                                        />
                                    </div>
                                )}

                                {isGridView && currentImageUrls.length > 0 && (
                                    <div className={`grid gap-4 ${getGridColumns(currentImageUrls.length)}`}>
                                        {currentImageUrls.map((url, index) => (
                                            <div
                                                key={index}
                                                className="relative aspect-square overflow-hidden border border-default-200 cursor-pointer"
                                                onClick={() => {
                                                    setCurrentImageUrl(url);
                                                    setIsGridView(false);
                                                }}
                                            >
                                                <Image
                                                    src={url}
                                                    alt={`${currentImageTitle} - 批次 ${index + 1}`}
                                                    width="100%"
                                                    height="100%"
                                                    className="object-cover"
                                                    onError={() => {
                                                        console.log('网格图片加载失败:', url);
                                                    }}
                                                />
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
                                    variant="light"
                                    onPress={onClose}
                                    startContent={<Icon icon="solar:close-circle-linear" width={18} />}
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


