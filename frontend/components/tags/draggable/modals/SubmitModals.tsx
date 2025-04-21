import React from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@heroui/react";
import { Input } from "@heroui/input";

interface SubmitModalsProps {
    // 登录提示模态框
    isLoginTipOpen: boolean;
    onLoginTipClose: () => void;
    onGoToLogin: () => void;

    // 提交确认模态框
    isConfirmOpen: boolean;
    onConfirmClose: () => void;
    onConfirmOpen: () => void; // 添加打开确认模态框的函数
    onConfirmAccept: () => void;
    totalImages: number;

    // 二次确认模态框
    isSecondConfirmOpen: boolean;
    onSecondConfirmClose: () => void;
    onSecondConfirmAccept: () => void;

    // 任务名称输入模态框
    isTaskNameModalOpen: boolean;
    onTaskNameModalOpen: () => void; // 添加打开任务名称输入模态框的函数
    onTaskNameModalClose: () => void;
    taskName: string;
    setTaskName: (name: string) => void;
    onSubmit: (taskName: string) => void;
}

/**
 * 提交流程相关的模态框组件集合
 * 包含登录提示、确认提交、二次确认和任务名称输入等模态框
 */
const SubmitModals: React.FC<SubmitModalsProps> = ({
    // 登录提示模态框
    isLoginTipOpen,
    onLoginTipClose,
    onGoToLogin,

    // 提交确认模态框
    isConfirmOpen,
    onConfirmClose,
    onConfirmOpen,
    onConfirmAccept,
    totalImages,

    // 二次确认模态框
    isSecondConfirmOpen,
    onSecondConfirmClose,
    onSecondConfirmAccept,

    // 任务名称输入模态框
    isTaskNameModalOpen,
    onTaskNameModalOpen,
    onTaskNameModalClose,
    taskName,
    setTaskName,
    onSubmit
}) => {
    return (
        <>
            {/* 登录提示模态框 */}
            <Modal isOpen={isLoginTipOpen} onOpenChange={onLoginTipClose}>
                <ModalContent>
                    {(onModalClose: () => void) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">
                                需要登录
                            </ModalHeader>
                            <ModalBody>
                                <div className="space-y-4">
                                    <p className="text-center">
                                        提交操作需要登录账号。请先登录后再进行提交。
                                    </p>
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button color="danger" variant="light" onPress={onModalClose}>
                                    取消
                                </Button>
                                <Button
                                    color="primary"
                                    onPress={() => {
                                        onModalClose();
                                        onGoToLogin();
                                    }}
                                >
                                    去登录
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {/* 提交确认模态框 */}
            <Modal isOpen={isConfirmOpen} onOpenChange={onConfirmClose}>
                <ModalContent>
                    {(onModalClose: () => void) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">
                                确认提交
                            </ModalHeader>
                            <ModalBody>
                                <div className="space-y-4">
                                    <p className="text-default-700">
                                        本次任务将生成 <span className="font-bold text-primary">{totalImages}</span> 张图片，这可能需要一定时间。
                                    </p>
                                    <p className="text-sm text-default-500">
                                        请确认是否继续？
                                    </p>
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button color="danger" variant="light" onPress={onModalClose}>
                                    取消
                                </Button>
                                <Button
                                    color="primary"
                                    onPress={() => {
                                        onModalClose();
                                        // 确认后打开任务名称输入模态框
                                        onTaskNameModalOpen();
                                    }}
                                >
                                    确认
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {/* 二次确认模态框（大量图片） */}
            <Modal isOpen={isSecondConfirmOpen} onOpenChange={onSecondConfirmClose}>
                <ModalContent>
                    {(onModalClose: () => void) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">
                                警告：大量图片生成
                            </ModalHeader>
                            <ModalBody>
                                <div className="space-y-4">
                                    <p className="text-center text-danger">
                                        警告：生成 <span className="font-bold">{totalImages}</span> 张图片可能需要较长时间，并消耗大量资源。
                                    </p>
                                    <p className="text-center">
                                        是否确认继续？
                                    </p>
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button color="danger" variant="light" onPress={onModalClose}>
                                    取消
                                </Button>
                                <Button
                                    color="danger"
                                    onPress={() => {
                                        onModalClose();
                                        // 二次确认后打开任务名称输入模态框
                                        onTaskNameModalOpen();
                                    }}
                                >
                                    确认继续
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {/* 任务名称输入模态框 */}
            <Modal isOpen={isTaskNameModalOpen} onOpenChange={onTaskNameModalClose}>
                <ModalContent>
                    {(onModalClose: () => void) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">
                                输入任务名称
                            </ModalHeader>
                            <ModalBody>
                                <div className="space-y-4">
                                    <p className="text-sm text-default-500">
                                        请为本次任务输入一个名称，便于后续识别和管理。
                                    </p>
                                    <Input
                                        label="任务名称"
                                        placeholder="输入任务名称"
                                        value={taskName}
                                        onValueChange={setTaskName}
                                        autoFocus
                                    />
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button color="danger" variant="light" onPress={onModalClose}>
                                    取消
                                </Button>
                                <Button
                                    color="primary"
                                    onPress={() => {
                                        // 如果没有输入任务名称，使用默认名称
                                        const finalTaskName = taskName.trim() || `无标题任务_${new Date().toLocaleString()}`;
                                        onModalClose();
                                        // 直接提交任务
                                        onSubmit(finalTaskName);
                                    }}
                                    isDisabled={false}
                                >
                                    提交
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </>
    );
};

export default SubmitModals;