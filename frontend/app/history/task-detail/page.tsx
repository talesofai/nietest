"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
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

// 搜索参数组件，用于获取URL参数
function SearchParamsComponent({
  onParamsReady,
}: {
  onParamsReady: (taskId: string | null) => void;
}) {
  const searchParams = useSearchParams();
  const taskId = searchParams.get("id");

  useEffect(() => {
    onParamsReady(taskId);
  }, [taskId, onParamsReady]);

  return null;
}

// 客户端组件，处理数据获取和渲染
export default function TaskDetailPage(): JSX.Element {
  const router = useRouter();
  const [taskId, setTaskId] = useState<string | null>(null);

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

  // 处理API错误 - 使用useCallback避免每次渲染都创建新函数
  const handleApiError = useCallback((errorMsg: string): void => {
    // eslint-disable-next-line no-console
    console.error(errorMsg);
    setError(errorMsg);
    setTask(null);
  }, []);

  // 处理搜索参数回调
  const handleParamsReady = useCallback((id: string | null) => {
    setTaskId(id);
  }, []);

  // 使用useRef跟踪是否正在加载数据，避免重复请求
  const isLoadingRef = useRef(false);
  const currentTaskIdRef = useRef<string | null>(null);

  // 使用useEffect的第一次渲染标志
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    // 如果是第一次渲染，或者taskId发生变化，则获取数据
    if (isFirstRenderRef.current || taskId !== currentTaskIdRef.current) {
      isFirstRenderRef.current = false;
    } else if (task !== null) {
      // 如果taskId没有变化，且已经有数据，则不再重复请求
      return;
    }

    // 更新当前taskId引用
    currentTaskIdRef.current = taskId;

    // 从缓存获取任务数据
    const getTaskFromCache = (taskId: string): TaskResponse | null => {
      const cacheKey = `task_${taskId}`;
      const cachedData = typeof window !== "undefined" ? sessionStorage.getItem(cacheKey) : null;

      if (!cachedData) return null;

      try {
        // 使用缓存数据
        // eslint-disable-next-line no-console
        console.log(`使用缓存的任务详情数据: ${taskId}`);

        return { success: true, data: JSON.parse(cachedData) };
      } catch {
        return null;
      }
    };

    // 缓存任务数据
    const cacheTaskData = (taskId: string, data: any): void => {
      if (typeof window === "undefined") return;

      const cacheKey = `task_${taskId}`;

      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("缓存任务详情数据失败:", error);
      }
    };

    // 处理任务数据
    const processTaskData = (response: TaskResponse): void => {
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

      // 处理可能的嵌套数据结构
      const actualTaskData = extractTaskData(taskData);

      // 验证任务数据
      if (actualTaskData.id) {
        setTask(actualTaskData as TaskDetail);
        setError(null);
      } else {
        handleApiError("任务详情为空或格式不正确");
      }
    };

    // 主要获取任务详情的函数
    const fetchTaskDetail = async (): Promise<void> => {
      if (!taskId) {
        setError("任务ID不存在");
        setLoading(false);

        return;
      }

      // 如果已经在加载中，则不再发起新请求
      if (isLoadingRef.current) {
        return;
      }

      // 标记为加载中
      isLoadingRef.current = true;
      setLoading(true);

      try {
        // eslint-disable-next-line no-console
        console.log(`尝试获取任务详情，ID: ${taskId}`);

        // 尝试从缓存获取数据
        let response = getTaskFromCache(taskId);

        // 如果缓存中没有数据，则从API获取
        if (!response) {
          response = await getTaskDetail(taskId);

          // 缓存成功的响应数据
          if (response.success && response.data) {
            cacheTaskData(taskId, response.data);
          }
        }

        // 处理获取到的数据
        processTaskData(response);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "获取任务详情失败";

        // eslint-disable-next-line no-console
        console.error("获取任务详情异常:", err);
        setError(`发生错误: ${errorMessage}`);
        setTask(null);
      } finally {
        setLoading(false);
        // 标记为加载完成
        isLoadingRef.current = false;
      }
    };

    fetchTaskDetail();
    // 依赖taskId、handleApiError和task，确保数据变化时能正确响应
  }, [taskId, handleApiError, task]);

  const handleBack = (): void => {
    router.push("/history");
  };

  return (
    <section className="w-full min-h-screen">
      {/* 使用Suspense包裹SearchParamsComponent */}
      <Suspense
        fallback={
          <div className="flex justify-center items-center h-40">
            <Spinner color="primary" size="lg" />
          </div>
        }
      >
        <SearchParamsComponent onParamsReady={handleParamsReady} />
      </Suspense>

      <Card className="w-full h-full border-none rounded-none">
        <CardHeader className="flex justify-between items-center px-6 py-4">
          <h1 className="text-2xl font-bold">任务详情</h1>
          <div className="flex gap-2">
            {taskId && (
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
            )}
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
