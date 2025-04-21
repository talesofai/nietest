import { useState } from "react";
import { useDisclosure } from "@heroui/react";
import { useRouter } from "next/navigation";
import { alertService } from "@/utils/alertService";
import { calculateTotalImages } from "@/components/tags/submit";
import { Tag } from "@/types/tag";
import { VariableValue } from "@/types/variable";

/**
 * 任务提交相关自定义 Hook
 * 处理任务提交流程和模态框
 */
export const useSubmitTask = (
    tags: Tag[],
    variableValues: VariableValue[],
    user: any | null
) => {
    // 路由
    const router = useRouter();

    // 模态框状态
    const {
        isOpen: isLoginTipOpen,
        onOpen: onLoginTipOpen,
        onClose: onLoginTipClose
    } = useDisclosure();

    // 提交确认模态框状态
    const {
        isOpen: isConfirmOpen,
        onOpen: onConfirmOpen,
        onClose: onConfirmClose
    } = useDisclosure();

    // 二次确认模态框状态（大量图片）
    const {
        isOpen: isSecondConfirmOpen,
        onOpen: onSecondConfirmOpen,
        onClose: onSecondConfirmClose
    } = useDisclosure();

    // 任务名称输入模态框状态
    const {
        isOpen: isTaskNameModalOpen,
        onOpen: onTaskNameModalOpen,
        onClose: onTaskNameModalClose
    } = useDisclosure();

    // 存储计算出的图片总数
    const [totalImages, setTotalImages] = useState<number>(0);

    // 任务名称状态
    const [taskName, setTaskName] = useState<string>("");

    // 处理提交操作
    const handleSubmit = () => {
        // 检查登录状态
        if (!user) {
            // 如果未登录，打开提示模态框
            onLoginTipOpen();
            return;
        }

        // 计算将生成的图片总数
        const calculatedImages = calculateTotalImages(tags, variableValues);
        setTotalImages(calculatedImages);

        // 如果图片数量为0，显示错误
        if (calculatedImages <= 0) {
            alertService.warning("提交失败", "无法计算生成图片数量，请检查参数设置");
            return;
        }

        // 如果超过50000张图片，显示错误
        if (calculatedImages > 50000) {
            alertService.warning("提交失败", "图片数量不能超过50000张");
            return;
        }

        // 清空任务名称
        setTaskName("");

        // 先打开确认模态框，显示图片数量
        onConfirmOpen();
    };

    // 执行提交流程
    const proceedWithSubmission = (taskNameParam: string) => {
        // 导入提交工具函数
        const { completeSubmitProcess } = require("@/components/tags/submit");
        // 传入任务名称
        completeSubmitProcess(tags, variableValues, taskNameParam)
            .then((result: any) => {
                if (result) {
                    console.log("提交成功:", result);
                    // 成功后的处理，跳转页面
                }
            });
    };

    return {
        // 模态框状态
        isLoginTipOpen,
        onLoginTipOpen,
        onLoginTipClose,
        isConfirmOpen,
        onConfirmOpen,
        onConfirmClose,
        isSecondConfirmOpen,
        onSecondConfirmOpen,
        onSecondConfirmClose,
        isTaskNameModalOpen,
        onTaskNameModalOpen,
        onTaskNameModalClose,
        // 任务数据
        totalImages,
        taskName,
        setTaskName,
        // 操作函数
        handleSubmit,
        proceedWithSubmission,
        // 导航
        router
    };
};