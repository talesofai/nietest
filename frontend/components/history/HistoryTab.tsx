"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Chip,
  Spinner,
  Input,
  Pagination,
} from "@heroui/react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";

import { TaskStatus, TaskDetail } from "@/types/task";
import { getTaskList } from "@/utils/taskService";
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
          status: `${TaskStatus.COMPLETED},${TaskStatus.FAILED},${TaskStatus.CANCELLED}`,
        };

        // 添加任务名称搜索
        if (searchTerm) {
          filters.task_name = searchTerm;
        }

        // 调试信息
        console.log(`获取任务列表，页码: ${page}, 每页数量: ${pageSize}, 过滤条件:`, filters);

        const listResponse = await getTaskList(page, pageSize, filters);

        // 调试响应
        console.log("任务列表响应:", listResponse);

        if (!listResponse.success) {
          // 处理错误情况，使用类型断言确保TypeScript不会报错
          const errorResponse = listResponse as { success: false; error: string; data: null };
          setError(errorResponse.error || "获取任务列表失败");
          setTasks([]);
          setTotalTasks(0);
        } else if (listResponse?.data) {
          const responseData = listResponse.data as any;
          console.log("响应数据结构:", responseData);

          // 尝试多种可能的数据结构
          if (Array.isArray(responseData)) {
            // 直接是数组的情况
            setTasks(responseData);
            // 如果没有总数信息，就使用当前数组长度
            setTotalTasks(responseData.length);
          } else if (Array.isArray(responseData.tasks)) {
            // 包含tasks数组的情况
            setTasks(responseData.tasks);
            setTotalTasks(responseData.total || responseData.tasks.length);
          } else if (Array.isArray(responseData.items)) {
            // 包含items数组的情况
            setTasks(responseData.items);
            setTotalTasks(responseData.total || responseData.items.length);
          } else if (responseData.data && Array.isArray(responseData.data)) {
            // 嵌套在data字段中的情况
            setTasks(responseData.data);
            setTotalTasks(responseData.total || responseData.data.length);
          } else {
            console.error("未知的响应数据结构:", responseData);
            setTasks([]);
            setTotalTasks(0);
          }
        } else {
          console.error("没有接收到有效的响应数据");
          setTasks([]);
          setTotalTasks(0);
        }

        initialLoadDone.current = true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载任务数据失败");
        // eslint-disable-next-line no-console
        // eslint-disable-next-line no-console
        // eslint-disable-next-line no-console
        console.error("加载任务数据失败:", err);
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData().catch(() => {
      setError("加载任务数据出错");
      setTasks([]);
      setLoading(false);
    });
  }, [refreshKey, page, pageSize, searchTerm]);

  // 处理分页变化
  const handlePageChange = (newPage: number) => {
    console.log(`设置页码: ${page} -> ${newPage}`);
    setPage(newPage);
    // 重置初始加载标志，强制重新加载数据
    initialLoadDone.current = false;
  };

  // 处理搜索
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setPage(1); // 重置到第一页
  };

  // 处理查看历史记录
  const handleViewHistory = (taskId: string) => {
    router.push(`/history/task-detail?id=${taskId}`);
  };

  // 渲染历史列表部分
  const renderHistoryList = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-40">
          <Spinner color="primary" size="lg" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center text-danger p-4 border border-danger rounded-lg">
          {error}
          <div className="mt-2">
            <Button color="primary" size="sm" onPress={() => setRefreshKey((prev) => prev + 1)}>
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
            <Card
              key={task.id}
              className="border border-default-200 shadow-sm hover:shadow-md transition-all"
            >
              <CardHeader className="flex justify-between items-center pb-2">
                <div>
                  <h3 className="text-lg font-semibold">
                    {task.task_name || `任务 ${task.id.substring(0, 8)}`}
                  </h3>
                  <p className="text-xs text-default-500">ID: {task.id.substring(0, 8)}...</p>
                </div>
                <Chip
                  color={
                    task.status === TaskStatus.COMPLETED
                      ? "success"
                      : task.status === TaskStatus.FAILED
                        ? "danger"
                        : task.status === TaskStatus.CANCELLED
                          ? "warning"
                          : "default"
                  }
                  size="sm"
                  variant="flat"
                >
                  {task.status === TaskStatus.COMPLETED
                    ? "已完成"
                    : task.status === TaskStatus.FAILED
                      ? "失败"
                      : task.status === TaskStatus.CANCELLED
                        ? "已取消"
                        : task.status}
                </Chip>
              </CardHeader>
              <CardBody className="pt-0">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <h5 className="text-xs font-semibold mb-1 text-default-600">创建时间</h5>
                    <div className="text-sm">{new Date(task.created_at).toLocaleString()}</div>
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
                    <div className="text-sm font-medium">{task.total_images || 0} 张图片</div>
                    {task.processed_images !== undefined && (
                      <Chip color="primary" size="sm" variant="flat">
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
                  <Button color="primary" size="sm" onPress={() => handleViewHistory(task.id)}>
                    查看详情
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>

        {/* 分页区域 */}
        <div className="flex flex-col items-center mt-4 space-y-2">
          {/* 显示分页信息 */}
          <div className="text-sm text-gray-500 w-full text-center">
            共 {totalTasks} 条记录，当前第 {page} 页，每页 {pageSize} 条
          </div>

          {/* 只有当总记录数大于每页数量时才显示分页控件 */}
          {totalTasks > pageSize && (
            <div className="w-full flex justify-center">
              <Pagination
                showControls
                color="primary"
                initialPage={page}
                page={page}
                size="sm"
                total={Math.ceil(totalTasks / pageSize)}
                onChange={(newPage) => {
                  console.log(`分页变化: ${page} -> ${newPage}`);
                  handlePageChange(newPage);
                }}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <motion.div
        animate={{ opacity: 1 }}
        className="p-4"
        initial={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-col space-y-4 mb-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">历史记录</h2>
            <Button
              color="primary"
              isDisabled={loading}
              size="sm"
              startContent={<Icon icon="solar:refresh-linear" width={16} />}
              variant="bordered"
              onPress={() => {
                initialLoadDone.current = false;
                setRefreshKey((prev) => prev + 1);
              }}
            >
              刷新
            </Button>
          </div>

          {/* 搜索框 */}
          <div className="flex w-full">
            <div className="relative flex-1">
              <Input
                className="w-full"
                endContent={
                  searchTerm && (
                    <Button isIconOnly size="sm" variant="light" onPress={() => handleSearch("")}>
                      <CloseIcon className="text-default-400" />
                    </Button>
                  )
                }
                placeholder="搜索任务名称..."
                startContent={<SearchIcon className="text-default-400" />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch(searchTerm);
                  }
                }}
              />
            </div>
            <Button
              className="ml-2"
              color="primary"
              isDisabled={loading}
              startContent={<Icon icon="solar:magnifer-linear" width={16} />}
              variant="bordered"
              onPress={() => handleSearch(searchTerm)}
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
