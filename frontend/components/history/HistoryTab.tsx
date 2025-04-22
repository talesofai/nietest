"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card, CardBody, CardHeader, Button, Chip, Spinner, Input, Pagination } from "@heroui/react";
import { motion } from "framer-motion";
import { TaskStatus, TaskDetail } from "@/app/api/client";
import { getTaskList } from "@/utils/taskService";
import { useRouter } from "next/navigation";
import { SearchIcon, CloseIcon } from "@/components/icons";

const HistoryTab: React.FC = () => {
    const router = useRouter();
    const initialLoadDone = useRef(false);

    const [tasks, setTasks] = useState<TaskDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0); // 用于强制刷新

    // 分页和搜索状态
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [totalTasks, setTotalTasks] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");

    // 加载任务列表
    useEffect(() => {
        if (initialLoadDone.current && refreshKey === 0) {
            return; // 避免首次加载后又自动刷新
        }

        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);

                // 构建查询参数，只获取已完成/失败/取消的任务
                const filters: Record<string, string> = {
                    status: `${TaskStatus.COMPLETED},${TaskStatus.FAILED},${TaskStatus.CANCELLED}`
                };

                // 添加任务名称搜索
                if (searchTerm) {
                    filters.task_name = searchTerm;
                }

                const listResponse = await getTaskList(page, pageSize, filters);

                if (listResponse?.error) {
                    setError(listResponse.error);
                    setTasks([]);
                    setTotalTasks(0);
                } else if (listResponse?.data) {
                    const responseData = listResponse.data as any;
                    if (Array.isArray(responseData.tasks)) {
                        setTasks(responseData.tasks);
                        setTotalTasks(responseData.total || responseData.tasks.length);
                    } else if (Array.isArray(responseData.items)) {
                        setTasks(responseData.items);
                        setTotalTasks(responseData.total || responseData.items.length);
                    } else {
                        setTasks([]);
                        setTotalTasks(0);
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
    }, [refreshKey, page, pageSize, searchTerm]);

    // 处理分页变化
    const handlePageChange = (newPage: number) => {
        setPage(newPage);
    };

    // 处理搜索
    const handleSearch = (term: string) => {
        setSearchTerm(term);
        setPage(1); // 重置到第一页
    };

    // 处理查看历史记录
    const handleViewHistory = (taskId: string) => {
        router.push(`/history/${taskId}`);
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
            <div className="flex flex-col space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tasks.map((task) => (
                        <Card key={task.id} className="border border-default-200 shadow-sm hover:shadow-md transition-all">
                            <CardHeader className="flex justify-between items-center pb-2">
                                <div>
                                    <h3 className="text-lg font-semibold">{task.task_name || `任务 ${task.id.substring(0, 8)}`}</h3>
                                    <p className="text-xs text-default-500">
                                        ID: {task.id.substring(0, 8)}...
                                    </p>
                                </div>
                                <Chip
                                    size="sm"
                                    color={
                                        task.status === TaskStatus.COMPLETED ? "success" :
                                        task.status === TaskStatus.FAILED ? "danger" :
                                        task.status === TaskStatus.CANCELLED ? "warning" : "default"
                                    }
                                    variant="flat"
                                >
                                    {
                                        task.status === TaskStatus.COMPLETED ? "已完成" :
                                        task.status === TaskStatus.FAILED ? "失败" :
                                        task.status === TaskStatus.CANCELLED ? "已取消" : task.status
                                    }
                                </Chip>
                            </CardHeader>
                            <CardBody className="pt-0">
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <h5 className="text-xs font-semibold mb-1 text-default-600">创建时间</h5>
                                        <div className="text-sm">
                                            {new Date(task.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                    <div>
                                        <h5 className="text-xs font-semibold mb-1 text-default-600">更新时间</h5>
                                        <div className="text-sm">
                                            {task.updated_at ? new Date(task.updated_at).toLocaleString() : "-"}
                                        </div>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <h5 className="text-xs font-semibold mb-1 text-default-600">图片数量</h5>
                                    <div className="flex items-center gap-2">
                                        <div className="text-sm font-medium">
                                            {task.total_images || 0} 张图片
                                        </div>
                                        {task.processed_images !== undefined && (
                                            <Chip size="sm" variant="flat" color="primary">
                                                已处理: {task.processed_images} 张
                                            </Chip>
                                        )}
                                    </div>
                                </div>

                                {task.error && (
                                    <div className="mb-4">
                                        <h5 className="text-xs font-semibold mb-1 text-danger">错误信息</h5>
                                        <div className="text-sm text-danger bg-danger-50 p-2 rounded-md">
                                            {task.error}
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end mt-2">
                                    <Button
                                        color="primary"
                                        size="sm"
                                        onPress={() => handleViewHistory(task.id)}
                                    >
                                        查看详情
                                    </Button>
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>

                {/* 分页组件 */}
                {totalTasks > pageSize && (
                    <div className="flex justify-center mt-4">
                        <Pagination
                            total={Math.ceil(totalTasks / pageSize)}
                            initialPage={page}
                            page={page}
                            onChange={handlePageChange}
                            showControls
                            color="primary"
                            size="sm"
                        />
                    </div>
                )}
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
                <div className="flex flex-col space-y-4 mb-4">
                    <div className="flex justify-between items-center">
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

                    {/* 搜索框 */}
                    <div className="flex w-full">
                        <div className="relative flex-1">
                            <Input
                                placeholder="搜索任务名称..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleSearch(searchTerm);
                                    }
                                }}
                                className="w-full"
                                startContent={<SearchIcon className="text-default-400" />}
                                endContent={
                                    searchTerm && (
                                        <Button
                                            isIconOnly
                                            size="sm"
                                            variant="light"
                                            onPress={() => handleSearch('')}
                                        >
                                            <CloseIcon className="text-default-400" />
                                        </Button>
                                    )
                                }
                            />
                        </div>
                        <Button
                            color="primary"
                            className="ml-2"
                            onPress={() => handleSearch(searchTerm)}
                            isDisabled={loading}
                        >
                            搜索
                        </Button>
                    </div>
                </div>

                {renderHistoryList()}
            </motion.div>
        </>
    );
};

export default HistoryTab;
