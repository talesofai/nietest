'use client';

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, Spinner, Button } from "@heroui/react";
import { motion } from "framer-motion";
import { getTaskDetail } from "@/utils/taskService";
import { alertService } from "@/utils/alertService";
import { TaskDetailView } from "@/components/history/TaskDetailView";
import { TaskDetail } from "@/types/task";

const TaskDetailPage = () => {
    const params = useParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [task, setTask] = useState<TaskDetail | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTaskDetail = async () => {
            if (!params.task_id) {
                setError("任务ID不存在");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const response = await getTaskDetail(params.task_id as string);

                if (response?.error) {
                    setError(response.error);
                    setTask(null);
                } else if (response?.data) {
                    // 适配API规范返回的数据
                    const taskData = response.data as any;
                    const actualTaskData = taskData.id ? taskData : (taskData.data || {});

                    if (actualTaskData.id) {
                        setTask(actualTaskData as TaskDetail);
                        setError(null);
                    } else {
                        setError("任务详情为空");
                        setTask(null);
                    }
                } else {
                    setError("获取任务详情失败");
                    setTask(null);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "获取任务详情失败");
                console.error("获取任务详情失败:", err);
                setTask(null);
            } finally {
                setLoading(false);
            }
        };

        fetchTaskDetail();
    }, [params.task_id]);

    const handleBack = () => {
        router.push("/history");
    };

    return (
        <section className="w-full min-h-screen">
            <Card className="w-full h-full border-none rounded-none">
                <CardHeader className="flex justify-between items-center px-6 py-4">
                    <h1 className="text-2xl font-bold">任务详情</h1>
                    <div className="flex gap-2">
                        <Button
                            color="secondary"
                            variant="light"
                            as="a"
                            href={`/history/${params.task_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            新标签页打开
                        </Button>
                        <Button
                            color="primary"
                            variant="light"
                            onPress={handleBack}
                        >
                            返回列表
                        </Button>
                    </div>
                </CardHeader>
                <CardBody className="p-0">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                        className="px-6"
                    >
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
                                        onPress={handleBack}
                                    >
                                        返回列表
                                    </Button>
                                </div>
                            </div>
                        ) : task ? (
                            <TaskDetailView task={task} />
                        ) : (
                            <div className="text-center text-gray-500 p-8 border border-dashed border-gray-300 rounded-lg">
                                未找到任务数据
                            </div>
                        )}
                    </motion.div>
                </CardBody>
            </Card>
        </section>
    );
};

export default TaskDetailPage;
