"use client";

import React, { useState } from "react";
import { Button } from "@heroui/react";
import { useDisclosure } from "@heroui/react";
import { useAuth } from "@/app/api/v1/auth";

// 导入子组件
import TagArea from "./draggable/TagArea";
import { ActionButtons } from "./draggable";
import { SettingsModal, SubmitModals } from "./draggable/modals";
import VariableValueList from "./variablevalue/VariableValueList";
import EditTagModal from "./draggable/modals/EditTagModal";

// 导入自定义 hooks
import {
    useAddTag,
    useConfigIO,
    useDragAndDrop,
    useEventListeners,
    useLocalStorage,
    useSubmitTask,
    useTagEdit,
    useVariableValues
} from "./draggable";

/**
 * 可拖拽标签主组件 v2 - 使用 dnd-kit
 */
const DroppableTagsV2: React.FC = () => {
    // 引入认证上下文和路由
    const { user } = useAuth();

    // 使用本地存储 Hook
    const {
        tags,
        setTags,
        variableValues,
        setVariableValues,
        globalSettings,
        setGlobalSettings,
        isDataLoaded
    } = useLocalStorage();

    // 设置模态框状态
    const {
        isOpen: isSettingsOpen,
        onOpen: onSettingsOpen,
        onClose: onSettingsClose
    } = useDisclosure();

    // 使用事件监听 Hook
    useEventListeners(setVariableValues);

    // 使用标签编辑 Hook
    const {
        editingTag,
        isEditingTagModalOpen,
        onEditingTagModalClose,
        startEditTag,
        saveEditTag,
        toggleTagVariable,
        removeTag,
        setEditingTag
    } = useTagEdit(tags, setTags, variableValues, setVariableValues);

    // 使用变量值操作 Hook
    const {
        handleReorderValues,
        addVariableValue,
        updateVariableValue,
        removeVariableValue,
        duplicateVariableValue
    } = useVariableValues(setVariableValues, tags);

    // 使用添加标签 Hook
    const {
        showAddForm,
        setShowAddForm,
        generateRandomColors,
        handleAddTag,
        previewColorRef,
        previewGradientColorRef
    } = useAddTag(tags, setTags, setVariableValues);

    // 使用配置导入导出 Hook
    const {
        handleDownloadConfig,
        handleUploadConfig,
        clearAllTags,
        createBaseConfig
    } = useConfigIO(tags, variableValues, globalSettings, setTags, setVariableValues, setGlobalSettings);

    // 使用任务提交 Hook
    const {
        isLoginTipOpen,
        onLoginTipClose,
        isConfirmOpen,
        onConfirmClose,
        isSecondConfirmOpen,
        onSecondConfirmClose,
        isTaskNameModalOpen,
        onTaskNameModalOpen,
        onTaskNameModalClose,
        totalImages,
        taskName,
        setTaskName,
        handleSubmit,
        proceedWithSubmission,
        router,
        onSecondConfirmOpen
    } = useSubmitTask(tags, variableValues, user);

    // 使用自定义拖拽Hook
    const {
        activeId,
        activeTagWidth,
        containerRef,
        sensors,
        handleDragStart,
        handleDragMove,
        handleDragEnd
    } = useDragAndDrop(setTags);

    // 获取活动中的标签
    const activeTag = activeId ? tags.find(tag => tag.id === activeId) || null : null;

    return (
        <div className="flex flex-col gap-6 w-full max-w-3xl mx-auto">
            {/* 全局设置按钮 */}
            <div className="flex justify-end">
                <Button
                    color="primary"
                    variant="solid"
                    onPress={onSettingsOpen}
                >
                    ⚙️ 全局设置
                </Button>
            </div>

            {/* 标签区域 */}
            <TagArea
                tags={tags}
                showAddForm={showAddForm}
                setShowAddForm={setShowAddForm}
                generateRandomColors={generateRandomColors}
                handleAddTag={handleAddTag}
                startEditTag={startEditTag}
                removeTag={removeTag}
                toggleTagVariable={toggleTagVariable}
                sensors={sensors}
                containerRef={containerRef}
                handleDragStart={handleDragStart}
                handleDragMove={handleDragMove}
                handleDragEnd={handleDragEnd}
                activeId={activeId}
                activeTag={activeTag}
                activeTagWidth={activeTagWidth}
            />

            {/* 操作按钮区域 */}
            <ActionButtons
                onCreateBaseConfig={createBaseConfig}
                onDownloadConfig={handleDownloadConfig}
                onUploadConfig={handleUploadConfig}
                onClearAllTags={clearAllTags}
                onSubmit={handleSubmit}
            />

            {/* 变量值区域 */}
            <VariableValueList
                tags={tags}
                variableValues={variableValues}
                onAddValue={addVariableValue}
                onUpdateValue={updateVariableValue}
                onRemoveValue={removeVariableValue}
                onDuplicateValue={duplicateVariableValue}
                onRemoveTag={removeTag}
                onReorderValues={handleReorderValues}
            />

            {/* 编辑标签模态窗口 */}
            <EditTagModal
                isOpen={isEditingTagModalOpen}
                onClose={() => {
                    setEditingTag(null);
                    onEditingTagModalClose();
                }}
                onSave={saveEditTag}
                tag={editingTag}
                tags={tags}
            />

            {/* 全局设置模态框 */}
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={onSettingsClose}
                globalSettings={globalSettings}
                setGlobalSettings={setGlobalSettings}
            />

            {/* 提交相关模态框组 */}
            <SubmitModals
                // 登录提示模态框
                isLoginTipOpen={isLoginTipOpen}
                onLoginTipClose={onLoginTipClose}
                onGoToLogin={() => router.push("/login")}

                // 提交确认模态框
                isConfirmOpen={isConfirmOpen}
                onConfirmClose={onConfirmClose}
                onConfirmAccept={() => {
                    if (totalImages > 1000) {
                        onSecondConfirmOpen();
                    } else {
                        onTaskNameModalOpen();
                    }
                }}
                totalImages={totalImages}

                // 二次确认模态框
                isSecondConfirmOpen={isSecondConfirmOpen}
                onSecondConfirmClose={onSecondConfirmClose}
                onSecondConfirmAccept={onTaskNameModalOpen}

                // 任务名称输入模态框
                isTaskNameModalOpen={isTaskNameModalOpen}
                onTaskNameModalClose={onTaskNameModalClose}
                taskName={taskName}
                setTaskName={setTaskName}
                onSubmit={proceedWithSubmission}
            />
        </div>
    );
};

export default DroppableTagsV2;