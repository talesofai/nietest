"use client";

import React, { useState, useEffect, useRef } from "react";
import { Select, SelectItem, Card, CardBody, CardHeader, Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Image, useDisclosure, Chip, Spinner } from "@heroui/react";
import { motion } from "framer-motion";
// 不再需要认证信息
import { TaskStatus, TaskDetail } from "@/app/api/client";
import { getTaskList, getTaskDetail } from "@/utils/taskService";
import { useRouter, useSearchParams } from "next/navigation";
import { alertService } from "@/utils/alertService";

// 图片结果数据
interface ResultViewData {
    xAxis: string;
    yAxis: string;
    xValue: string;
    yValue: string;
    imageUrl: string;
    title: string;
}

// 占位图片URL
const PLACEHOLDER_IMAGE_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256' viewBox='0 0 256 256'%3E%3Crect width='256' height='256' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='24' fill='%23aaaaaa' text-anchor='middle' dominant-baseline='middle'%3E无图片%3C/text%3E%3C/svg%3E";

const HistoryTab: React.FC = () => {
    // 不再需要用户信息，因为任务是所有账户共用的
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialLoadDone = useRef(false);

    const [tasks, setTasks] = useState<TaskDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0); // 用于强制刷新

    const [selectedTask, setSelectedTask] = useState<TaskDetail | null>(null);
    const [xAxis, setXAxis] = useState<string>("");
    const [yAxis, setYAxis] = useState<string>("");
    const [availableVariables, setAvailableVariables] = useState<string[]>([]);
    const [selectedResult, setSelectedResult] = useState<ResultViewData | null>(null);

    // 结果查看模态框状态
    const { isOpen: isResultViewOpen, onOpen: onResultViewOpen, onClose: onResultViewClose } = useDisclosure();

    // 全屏表格模态框状态
    const { isOpen: isTableViewOpen, onOpen: onTableViewOpen, onClose: onTableViewClose } = useDisclosure();

    // 合并加载任务列表和URL参数检查逻辑
    useEffect(() => {
        if (initialLoadDone.current && refreshKey === 0) {
            return; // 避免首次加载后又自动刷新
        }

        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);

                // 检查URL参数中是否有任务ID
                const taskId = searchParams.get('task');

                if (taskId) {
                    // 如果URL中有任务ID，直接获取该任务详情
                    const detailResponse = await getTaskDetail(taskId);

                    if (detailResponse?.data) {
                        const taskData = detailResponse.data as any;
                        const actualTaskData = taskData.id ? taskData : (taskData.data || {});

                        if (actualTaskData.id) {
                            setSelectedTask(actualTaskData as TaskDetail);
                            onTableViewOpen();
                        } else {
                            alertService.error('任务详情为空', '未找到任务数据');
                        }
                    }
                }

                // 无论是否查看单个任务详情，都加载任务列表
                const listResponse = await getTaskList(1, 10, undefined, TaskStatus.COMPLETED);

                if (listResponse?.error) {
                    setError(listResponse.error);
                    setTasks([]);
                } else if (listResponse?.data) {
                    const responseData = listResponse.data as any;
                    if (Array.isArray(responseData.tasks)) {
                        setTasks(responseData.tasks);
                    } else if (Array.isArray(responseData.items)) {
                        setTasks(responseData.items);
                    } else {
                        setTasks([]);
                    }
                } else {
                    setTasks([]);
                }

                initialLoadDone.current = true;
            } catch (err) {
                setError(err instanceof Error ? err.message : '加载任务数据失败');
                console.error('加载任务数据失败:', err);
                setTasks([]);
            } finally {
                setLoading(false);
            }
        };

        fetchData().catch(() => {
            setError('加载任务数据出错');
            setTasks([]);
            setLoading(false);
        });
    }, [searchParams, refreshKey, onTableViewOpen]);

    // 当选择的任务变化时，更新可用变量
    useEffect(() => {
        if (selectedTask && selectedTask.results) {
            // 从结果中提取变量
            const variables: string[] = [];

            // 检查结果结构
            if (selectedTask.results.single) {
                // 单一结果
                Object.keys(selectedTask.results.single).forEach(key => {
                    if (!variables.includes(key)) {
                        variables.push(key);
                    }
                });
            } else if (selectedTask.results.matrix) {
                // 矩阵结果
                Object.keys(selectedTask.results.matrix).forEach(key => {
                    if (!variables.includes(key)) {
                        variables.push(key);
                    }
                });
            }

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
        }
    }, [selectedTask]);

    // 生成表格数据
    const generateTableData = () => {
        if (!selectedTask || !selectedTask.results || !xAxis || !yAxis) return null;

        // 获取X轴和Y轴的值
        let xValues: string[] = [];
        let yValues: string[] = [];

        // 从结果中提取X轴和Y轴的值
        if (selectedTask.results.matrix && selectedTask.results.matrix[xAxis] && selectedTask.results.matrix[yAxis]) {
            xValues = Object.keys(selectedTask.results.matrix[xAxis]);
            yValues = Object.keys(selectedTask.results.matrix[yAxis]);
        } else if (selectedTask.results.single && selectedTask.results.single[xAxis] && selectedTask.results.single[yAxis]) {
            xValues = Object.keys(selectedTask.results.single[xAxis]);
            yValues = Object.keys(selectedTask.results.single[yAxis]);
        }

        return {
            xValues,
            yValues,
            data: selectedTask.results
        };
    };

    const tableData = generateTableData();

    // 处理查看历史记录
    const handleViewHistory = async (task: TaskDetail) => {
        try {
            // 避免重复请求详情 - 如果任务已经有完整信息，直接使用
            if (task.results) {
                setSelectedTask(task);
                onTableViewOpen();
                return;
            }

            // 否则获取完整的任务详情
            const response = await getTaskDetail(task.id);
            if (response?.error) {
                alertService.error('获取任务详情失败', response.error);
                return;
            }

            if (response?.data) {
                // 适配API规范返回的数据
                // 获取实际的任务数据，可能位于data字段内
                const taskData = response.data as any;
                const actualTaskData = taskData.id ? taskData : (taskData.data || {});

                if (actualTaskData.id) {
                    setSelectedTask(actualTaskData as TaskDetail);
                    onTableViewOpen();
                } else {
                    alertService.error('任务详情为空', '未找到任务数据');
                }
            } else {
                alertService.error('任务详情为空', '未找到任务数据');
            }
        } catch (error) {
            alertService.error('获取任务详情失败', error instanceof Error ? error.message : '发生未知错误');
            console.error('获取任务详情失败:', error);
        }
    };

    // 获取图片URL
    const getImageUrl = (xValue: string, yValue: string) => {
        if (!selectedTask || !selectedTask.results) return null;

        // 检查结果结构
        if (selectedTask.results.matrix) {
            // 矩阵结果
            return selectedTask.results.matrix[xAxis]?.[xValue]?.[yAxis]?.[yValue] || null;
        } else if (selectedTask.results.single) {
            // 单一结果
            if (xAxis === yAxis) {
                return null; // 不允许X轴和Y轴相同
            }

            // 尝试从单一结果中获取图片URL
            return selectedTask.results.single[xAxis]?.[xValue] ||
                selectedTask.results.single[yAxis]?.[yValue] || null;
        }

        return null;
    };

    // 渲染历史列表部分
    const renderHistoryList = () => {
        if (loading) {
            return (
                <div className="flex justify-center items-center h-40">
                    <Spinner size="lg" color="primary" />
                </div>
            );
        }

        if (error) {
            return (
                <div className="text-center text-danger p-4 border border-danger rounded-lg">
                    {error}
                    <div className="mt-2">
                        <Button
                            size="sm"
                            color="primary"
                            onPress={() => setRefreshKey(prev => prev + 1)}
                        >
                            重试
                        </Button>
                    </div>
                </div>
            );
        }

        if (tasks.length === 0) {
            return (
                <div className="text-center text-gray-500 p-8 border border-dashed border-gray-300 rounded-lg">
                    暂无历史记录
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tasks.map((task) => (
                    <Card key={task.id} className="shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="pb-0">
                            <h3 className="text-base font-medium">{task.task_name || `任务 ${task.id.substring(0, 8)}`}</h3>
                        </CardHeader>
                        <CardBody className="pt-0">
                            <div className="mb-3">
                                <h5 className="text-xs font-semibold mb-1">状态</h5>
                                <Chip size="sm" color={task.status === TaskStatus.COMPLETED ? "success" : "default"} variant="flat">
                                    {task.status === TaskStatus.COMPLETED ? "已完成" : task.status}
                                </Chip>
                            </div>
                            <div className="mb-3">
                                <h5 className="text-xs font-semibold mb-1">图片数量</h5>
                                <div className="text-xs">
                                    {task.total_images || 0} 张图片
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Button
                                    color="primary"
                                    size="sm"
                                    onPress={() => handleViewHistory(task)}
                                >
                                    查看详情
                                </Button>
                            </div>
                        </CardBody>
                    </Card>
                ))}
            </div>
        );
    };

    return (
        <>
            <motion.div
                className="p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">历史记录</h2>
                    <Button
                        size="sm"
                        color="primary"
                        variant="light"
                        isDisabled={loading}
                        onPress={() => {
                            initialLoadDone.current = false;
                            setRefreshKey(prev => prev + 1);
                        }}
                    >
                        刷新
                    </Button>
                </div>

                {renderHistoryList()}
            </motion.div>

            {/* 全屏表格模态框 */}
            <Modal
                isOpen={isTableViewOpen}
                onClose={onTableViewClose}
                size="full"
                scrollBehavior="inside"
                hideCloseButton
            >
                <ModalContent>
                    {(onModalClose) => (
                        <>
                            <ModalHeader className="flex justify-between items-center">
                                <div>
                                    {selectedTask && (
                                        <h2 className="text-xl">
                                            {selectedTask.task_name || `任务 ID: ${selectedTask.id}`} - {new Date(selectedTask.created_at).toLocaleString()}
                                        </h2>
                                    )}
                                </div>
                                <Button
                                    color="danger"
                                    variant="light"
                                    onPress={onModalClose}
                                >
                                    关闭
                                </Button>
                            </ModalHeader>
                            <ModalBody className="p-4">
                                {selectedTask ? (
                                    <div className="space-y-6">
                                        {availableVariables.length >= 2 ? (
                                            <Card className="mb-6">
                                                <CardHeader>
                                                    <h3 className="text-lg font-semibold">XY表格设置</h3>
                                                </CardHeader>
                                                <CardBody>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <Select
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
                                                                }
                                                            }}
                                                        >
                                                            {availableVariables.map((variable) => (
                                                                <SelectItem key={variable}>
                                                                    {variable}
                                                                </SelectItem>
                                                            ))}
                                                        </Select>
                                                        <Select
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
                                                                }
                                                            }}
                                                        >
                                                            {availableVariables.map((variable) => (
                                                                <SelectItem key={variable} className={variable === xAxis ? "opacity-50 pointer-events-none" : ""}>
                                                                    {variable}
                                                                </SelectItem>
                                                            ))}
                                                        </Select>
                                                    </div>
                                                </CardBody>
                                            </Card>
                                        ) : (
                                            <Card className="mb-6">
                                                <CardBody>
                                                    <div className="text-center text-default-500">
                                                        此任务没有足够的变量来创建XY表格
                                                    </div>
                                                </CardBody>
                                            </Card>
                                        )}

                                        {tableData && (
                                            <Card>
                                                <CardHeader>
                                                    <h3 className="text-lg font-semibold">结果表格</h3>
                                                </CardHeader>
                                                <CardBody>
                                                    <div className="overflow-x-auto" style={{ maxWidth: '100%', overflowX: 'scroll' }}>
                                                        <table className="border-collapse" style={{ tableLayout: 'fixed', width: 'auto', borderSpacing: 0, borderCollapse: 'collapse', borderRadius: 0 }}>
                                                            <thead>
                                                                <tr>
                                                                    <th className="border p-1 bg-default-100 text-xs w-20" style={{ minWidth: '80px', borderRadius: 0 }}>{xAxis} / {yAxis}</th>
                                                                    {tableData.xValues.map((xValue) => (
                                                                        <th key={xValue} className="border p-1 bg-default-100 text-xs" style={{ width: '256px', minWidth: '256px', maxWidth: '256px', borderRadius: 0 }}>
                                                                            {xValue}
                                                                        </th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {tableData.yValues.map((yValue) => (
                                                                    <tr key={yValue}>
                                                                        <td className="border p-1 font-medium bg-default-50 text-xs w-20" style={{ minWidth: '80px', borderRadius: 0 }}>
                                                                            {yValue}
                                                                        </td>
                                                                        {tableData.xValues.map((xValue) => {
                                                                            const imageUrl = getImageUrl(xValue, yValue);
                                                                            return (
                                                                                <td key={`${yValue}-${xValue}`} className="border p-2 text-center" style={{ width: '256px', height: '256px', minWidth: '256px', minHeight: '256px', maxWidth: '256px', borderRadius: 0 }}>
                                                                                    {imageUrl ? (
                                                                                        <div className="flex flex-col items-center">
                                                                                            <div className="w-64 h-64 overflow-hidden mb-1">
                                                                                                <Image
                                                                                                    src={imageUrl}
                                                                                                    alt={`${yValue}-${xValue}`}
                                                                                                    width={256}
                                                                                                    height={256}
                                                                                                    radius="none"
                                                                                                    isZoomed
                                                                                                    onError={() => {
                                                                                                        // 当图片加载失败时使用占位图片
                                                                                                        const imgElements = document.querySelectorAll('img[src="' + imageUrl + '"]');
                                                                                                        imgElements.forEach(img => {
                                                                                                            img.setAttribute('src', PLACEHOLDER_IMAGE_URL);
                                                                                                        });
                                                                                                    }}
                                                                                                />
                                                                                            </div>
                                                                                            <Button
                                                                                                size="sm"
                                                                                                variant="flat"
                                                                                                color="primary"
                                                                                                onPress={() => {
                                                                                                    setSelectedResult({
                                                                                                        xAxis,
                                                                                                        yAxis,
                                                                                                        xValue,
                                                                                                        yValue,
                                                                                                        imageUrl,
                                                                                                        title: `${yValue} + ${xValue}`
                                                                                                    });
                                                                                                    onResultViewOpen();
                                                                                                }}
                                                                                            >
                                                                                                查看
                                                                                            </Button>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className="flex flex-col items-center">
                                                                                            <div className="w-64 h-64 overflow-hidden mb-1">
                                                                                                <Image
                                                                                                    src={PLACEHOLDER_IMAGE_URL}
                                                                                                    alt="占位图片"
                                                                                                    width={256}
                                                                                                    height={256}
                                                                                                    radius="none"
                                                                                                />
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
                                    </div>
                                ) : (
                                    <div className="flex justify-center items-center h-40">
                                        <Spinner size="lg" color="primary" />
                                    </div>
                                )}
                            </ModalBody>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {/* 结果查看模态框 */}
            <Modal
                isOpen={isResultViewOpen}
                onClose={onResultViewClose}
                size="full"
                scrollBehavior="inside"
                hideCloseButton
            >
                <ModalContent>
                    {(onModalClose) => (
                        <>
                            <ModalHeader className="flex justify-between items-center">
                                <div>
                                    {selectedResult && (
                                        <h2 className="text-xl">
                                            {selectedResult.title}
                                        </h2>
                                    )}
                                </div>
                                <Button
                                    color="danger"
                                    variant="light"
                                    onPress={onModalClose}
                                >
                                    关闭
                                </Button>
                            </ModalHeader>
                            <ModalBody className="p-0">
                                {selectedResult && (
                                    <div className="flex flex-col items-center justify-center min-h-[80vh]">
                                        <div className="relative w-full max-w-4xl">
                                            <Image
                                                src={selectedResult.imageUrl}
                                                alt={selectedResult.title}
                                                width={800}
                                                height={600}
                                                radius="md"
                                                shadow="md"
                                                isZoomed
                                                onError={() => {
                                                    // 当图片加载失败时使用占位图片
                                                    const imgElements = document.querySelectorAll('img[src="' + selectedResult.imageUrl + '"]');
                                                    imgElements.forEach(img => {
                                                        img.setAttribute('src', PLACEHOLDER_IMAGE_URL);
                                                    });
                                                }}
                                            />
                                        </div>
                                        <div className="mt-4 p-4 bg-default-50 rounded-lg w-full max-w-4xl">
                                            <h3 className="text-lg font-semibold mb-2">图片信息</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-sm text-default-500">{selectedResult.xAxis}</p>
                                                    <p className="font-medium">{selectedResult.xValue}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-default-500">{selectedResult.yAxis}</p>
                                                    <p className="font-medium">{selectedResult.yValue}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </ModalBody>
                            <ModalFooter className="flex justify-between">
                                <Button
                                    color="default"
                                    variant="flat"
                                    as="a"
                                    href={selectedResult?.imageUrl}
                                    target="_blank"
                                    download
                                >
                                    下载图片
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </>
    );
};

export default HistoryTab;
