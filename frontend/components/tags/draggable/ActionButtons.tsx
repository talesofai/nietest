import React from "react";
import { Button } from "@heroui/react";

interface ActionButtonsProps {
    // 配置操作
    onCreateBaseConfig: () => void;
    onDownloadConfig: () => void;
    onUploadConfig: () => void;
    onClearAllTags: () => void;

    // 提交操作
    onSubmit: () => void;
}

/**
 * 操作按钮组件
 * 包含基础配置、下载配置、上传配置、清空和提交按钮
 */
const ActionButtons: React.FC<ActionButtonsProps> = ({
    onCreateBaseConfig,
    onDownloadConfig,
    onUploadConfig,
    onClearAllTags,
    onSubmit
}) => {
    return (
        <div className="flex justify-between items-center gap-4">
            <div className="flex gap-2">
                <Button
                    color="primary"
                    variant="flat"
                    onPress={onCreateBaseConfig}
                >
                    基础配置
                </Button>
                <Button
                    color="secondary"
                    variant="flat"
                    onPress={onDownloadConfig}
                >
                    下载配置
                </Button>
                <Button
                    color="secondary"
                    variant="flat"
                    onPress={onUploadConfig}
                >
                    上传配置
                </Button>
                <Button
                    color="danger"
                    variant="flat"
                    onPress={onClearAllTags}
                >
                    清空
                </Button>
            </div>
            <Button
                color="success"
                variant="shadow"
                onPress={onSubmit}
            >
                提交
            </Button>
        </div>
    );
};

export default ActionButtons;