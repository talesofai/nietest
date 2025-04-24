"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, Spinner, Button } from "@heroui/react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";

import { getTaskDetail } from "@/utils/taskService";
import { TaskDetailView } from "@/components/history/TaskDetailView";
import { TaskDetail } from "@/types/task";

interface TaskResponse {
  success: boolean;
  error?: string;
  data?: any;
}

// 客户端组件，处理数据获取和渲染
export default function TaskDetailPage(): JSX.Element {
  const searchParams = useSearchParams();
  const router = useRouter();
  const taskId = searchParams.get("id");

  const [loading, setLoading] = useState<boolean>(true);
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 处理API返回的嵌套数据结构
  const extractTaskData = (taskData: any): any => {
    if (taskData.id) {
      return taskData;
    }
    if (taskData.data?.id) {
      return taskData.data;
    }
    if (taskData.data?.data?.id) {
      return taskData.data.data;
    }

    return {};
  };

  // 处理API错误
  const handleApiError = (errorMsg: string): void => {
    // eslint-disable-next-line no-console
    console.error(errorMsg);
    setError(errorMsg);
    setTask(null);
  };

  useEffect(() => {
    const fetchTaskDetail = async (): Promise<void> => {
      if (!taskId) {
        setError("任务ID不存在");
        setLoading(false);

        return;
      }

      try {
        setLoading(true);
        // eslint-disable-next-line no-console
        console.log(`尝试获取任务详情，ID: ${taskId}`);

        const response: TaskResponse = await getTaskDetail(taskId);

        // eslint-disable-next-line no-console
        console.log("获取任务详情响应:", response);

        // 处理错误响应
        if (response?.error) {
          handleApiError(response.error);

          return;
        }

        // 处理没有数据的响应
        if (!response?.data) {
          handleApiError("获取任务详情失败，服务器没有返回数据");

          return;
        }

        // 适配API规范返回的数据
        const taskData = response.data;

        // eslint-disable-next-line no-console
        console.log("原始任务数据:", taskData);

        // 处理可能的嵌套数据结构
        const actualTaskData = extractTaskData(taskData);

        // eslint-disable-next-line no-console
        console.log("处理后的任务数据:", actualTaskData);

        // 验证任务数据
        if (actualTaskData.id) {
          setTask(actualTaskData as TaskDetail);
          setError(null);
        } else {
          handleApiError("任务详情为空或格式不正确");
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "获取任务详情失败";

        // eslint-disable-next-line no-console
        console.error("获取任务详情异常:", err);
        setError(`发生错误: ${errorMessage}`);
        setTask(null);
      } finally {
        setLoading(false);
      }
    };

    fetchTaskDetail();
  }, [taskId]);

  const handleBack = (): void => {
    router.push("/history");
  };

  return (
    <section className="w-full min-h-screen">
      <Card className="w-full h-full border-none rounded-none">
        <CardHeader className="flex justify-between items-center px-6 py-4">
          <h1 className="text-2xl font-bold">任务详情</h1>
          <div className="flex gap-2">
            <Button
              as="a"
              color="secondary"
              href={`/history/task-detail?id=${taskId}`}
              rel="noopener noreferrer"
              startContent={<Icon icon="solar:square-top-right-linear" width={16} />}
              target="_blank"
              variant="bordered"
            >
              新标签页打开
            </Button>
            <Button
              color="primary"
              startContent={<Icon icon="solar:arrow-left-linear" width={16} />}
              variant="bordered"
              onPress={handleBack}
            >
              返回列表
            </Button>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <motion.div
            animate={{ opacity: 1 }}
            className="px-6"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {loading ? (
              <div className="flex justify-center items-center h-40">
                <Spinner color="primary" size="lg" />
              </div>
            ) : error ? (
              <div className="text-center text-danger p-4 border border-danger rounded-lg">
                {error}
                <div className="mt-2">
                  <Button color="primary" size="sm" onPress={handleBack}>
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
}
