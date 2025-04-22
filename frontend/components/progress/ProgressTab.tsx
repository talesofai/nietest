"use client";

import React, { useState, useEffect } from "react";
import { Card, CardBody, CardHeader, Progress, Chip, Button, Spinner } from "@heroui/react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { TaskStatus, TaskDetail } from "@/app/api/client";
import { getTaskList, cancelTask } from "@/utils/taskService";
import { alertService } from "@/utils/alertService";
import { useRouter } from "next/navigation";

const ProgressTab: React.FC = () => {
    const router = useRouter();
    const [tasks, setTasks] = useState<TaskDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0); // 用于强制刷新

    // 获取状态对应的颜色
    const getStatusColor = (status: TaskStatus) => {
        switch (status) {
            case TaskStatus.PENDING: return "default";
            case TaskStatus.PROCESSING: return "primary";
            case TaskStatus.COMPLETED: return "success";
            case TaskStatus.FAILED: return "danger";
            case TaskStatus.CANCELLED: return "warning";
            default: return "default";
        }
    };

    // 获取状态对应的文本
    const getStatusText = (status: TaskStatus) => {
        switch (status) {
            case TaskStatus.PENDING: return "等待中";
            case TaskStatus.PROCESSING: return "处理中";
            case TaskStatus.COMPLETED: return "已完成";
            case TaskStatus.FAILED: return "失败";
            case TaskStatus.CANCELLED: return "已取消";
            default: return "未知";
        }
    };

    // 加载任务列表
    useEffect(() => {
        const fetchTasks = async () => {
            try {
                setLoading(true);
                setError(null);
                // 只获取未开始和执行中的任务
                const response = await getTaskList(1, 10, {
                    status: `${TaskStatus.PENDING},${TaskStatus.PROCESSING}`
                });

                if (response?.error) {
                    setError(response.error);
                    setTasks([]);
                } else if (response?.data) {
                    const responseData = response.data as any;
                    if (Array.isArray(responseData.tasks)) {
                        setTasks(responseData.tasks);
                    } else {
                        setTasks([]);
                    }
                } else {
                    setTasks([]);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : '加载任务列表失败');
                console.error('加载任务列表失败:', err);
                setTasks([]);
            } finally {
                setLoading(false);
            }
        };

        fetchTasks().catch(() => {
            // 捕获所有未处理的异常，避免组件崩溃
            setError('加载任务数据出错');
            setTasks([]);
            setLoading(false);
        });

        // 设置定时器，每10秒刷新一次
        const intervalId = setInterval(() => {
            setRefreshKey(prev => prev + 1);
        }, 10000);

        return () => clearInterval(intervalId);
    }, [refreshKey]);

    // 取消任务
    const handleCancelTask = async (taskId: string) => {
        try {
            const response = await cancelTask(taskId);

            if (response?.error) {
                alertService.error('取消任务失败', response.error);
            } else {
                alertService.success('取消任务成功', '任务已成功取消');
                // 刷新任务列表
                setRefreshKey(prev => prev + 1);
            }
        } catch (err) {
            alertService.error('取消任务失败', err instanceof Error ? err.message : '发生未知错误');
            console.error('取消任务失败:', err);
        }
    };

    // 查看任务结果
    const handleViewResults = (taskId: string) => {
        router.push(`/history?task=${taskId}`);
    };

    return (
        <motion.div
            className="p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
        >
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">任务进度</h2>
                <Button
                    size="sm"
                    color="primary"
                    variant="bordered"
                    isDisabled={loading}
                    startContent={<Icon icon="solar:refresh-linear" width={16} />}
                    onPress={() => setRefreshKey(prev => prev + 1)}
                >
                    刷新
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-40">
                    <Spinner size="lg" color="primary" />
                </div>
            ) : error ? (
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
            ) : tasks.length === 0 ? (
                <div className="text-center text-gray-500 p-8 border border-dashed border-gray-300 rounded-lg">
                    暂无任务记录
                </div>
            ) : (
                <div className="space-y-4">
                    {tasks.map((task) => (
                        <Card key={task.id} className="w-full border border-default-200 shadow-sm hover:shadow-md transition-all">
                            <CardHeader className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold">{task.task_name}</h3>
                                <Chip color={getStatusColor(task.status as TaskStatus)} variant="flat">
                                    {getStatusText(task.status as TaskStatus)}
                                </Chip>
                            </CardHeader>
                            <CardBody>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-sm">进度: {task.progress || 0}%</span>
                                            <span className="text-sm">{task.processed_images || 0}/{task.total_images || 0} 张图片</span>
                                        </div>
                                        <Progress
                                            value={task.progress || 0}
                                            color={getStatusColor(task.status as TaskStatus)}
                                            className="w-full"
                                        />
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <div className="text-sm text-default-500">
                                            创建时间: {new Date(task.created_at).toLocaleString()}
                                        </div>
                                        <div className="flex gap-2">
                                            {task.status === TaskStatus.PROCESSING && (
                                                <Button
                                                    size="sm"
                                                    color="danger"
                                                    variant="bordered"
                                                    startContent={<Icon icon="solar:close-circle-linear" width={16} />}
                                                    onPress={() => handleCancelTask(task.id)}
                                                >
                                                    取消
                                                </Button>
                                            )}
                                            {task.status === TaskStatus.PENDING && (
                                                <Button
                                                    size="sm"
                                                    color="danger"
                                                    variant="bordered"
                                                    startContent={<Icon icon="solar:close-circle-linear" width={16} />}
                                                    onPress={() => handleCancelTask(task.id)}
                                                >
                                                    取消
                                                </Button>
                                            )}
                                            {task.status === TaskStatus.COMPLETED && (
                                                <Button
                                                    size="sm"
                                                    color="primary"
                                                    variant="bordered"
                                                    startContent={<Icon icon="solar:eye-linear" width={16} />}
                                                    onPress={() => handleViewResults(task.id)}
                                                >
                                                    查看结果
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}
        </motion.div>
    );
};

export default ProgressTab;
