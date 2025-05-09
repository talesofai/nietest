"use client";

import React from "react";
import { Button } from "@heroui/react";
import { useDisclosure } from "@heroui/react";

import { useAuth } from "@/lib/auth";

// 导入子组件
import { ActionButtons } from "./draggable";
import TagArea from "./draggable/TagArea";
import EditTagModal from "./draggable/modals/EditTagModal";
import { SettingsModal, SubmitModals } from "./draggable/modals";
import VariableValueList from "./variablevalue/VariableValueList";
// 导入自定义 hooks
import {
  useAddTag,
  useConfigIO,
  useDragAndDrop,
  useEventListeners,
  useLocalStorage,
  useSubmitTask,
  useTagEdit,
  useTaskReuse,
  useVariableValues,
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
    // isDataLoaded 未使用
    // isDataLoaded,
  } = useLocalStorage();

  // 设置模态框状态
  const {
    isOpen: isSettingsOpen,
    onOpen: onSettingsOpen,
    onClose: onSettingsClose,
  } = useDisclosure();

  // 使用事件监听 Hook
  useEventListeners(setVariableValues);

  // 使用任务复用 Hook
  const {
    hasReusedTask,
    reusedTaskInfo,
    applyReusedSettings,
    ignoreReusedSettings,
  } = useTaskReuse(setTags, setVariableValues, setGlobalSettings);

  // 使用标签编辑 Hook
  const {
    editingTag,
    isEditingTagModalOpen,
    onEditingTagModalClose,
    startEditTag,
    saveEditTag,
    toggleTagVariable,
    removeTag,
    setEditingTag,
  } = useTagEdit(tags, setTags, variableValues, setVariableValues);

  // 使用变量值操作 Hook
  const {
    handleReorderValues,
    addVariableValue,
    updateVariableValue,
    removeVariableValue,
    duplicateVariableValue,
  } = useVariableValues(setVariableValues, tags);

  // 使用添加标签 Hook
  const {
    showAddForm,
    setShowAddForm,
    generateRandomColors,
    handleAddTag,
    // previewColorRef 和 previewGradientColorRef 未使用
    // previewColorRef,
    // previewGradientColorRef,
  } = useAddTag(tags, setTags, setVariableValues);

  // 使用配置导入导出 Hook
  const { handleDownloadConfig, handleUploadConfig, clearAllTags, createBaseConfig } = useConfigIO(
    tags,
    variableValues,
    globalSettings,
    setTags,
    setVariableValues,
    setGlobalSettings
  );

  // 使用任务提交 Hook
  const {
    isLoginTipOpen,
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
    totalImages,
    taskName,
    setTaskName,
    handleSubmit,
    proceedWithSubmission,
    router,
  } = useSubmitTask(tags, variableValues, user);

  // 使用自定义拖拽Hook
  const {
    activeId,
    activeTagWidth,
    containerRef,
    sensors,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  } = useDragAndDrop(setTags);

  // 获取活动中的标签
  const activeTag = activeId ? tags.find((tag) => tag.id === activeId) || null : null;

  return (
    <div className="flex flex-col gap-6 w-full max-w-3xl mx-auto">
      {/* 全局设置按钮和任务复用提示 */}
      <div className="flex justify-between items-center">
        <div className="flex-1">
          {hasReusedTask && (
            <div className="flex items-center gap-2">
              <div className="bg-success-100 text-success-700 px-3 py-1 rounded-md text-sm">
                检测到复用的任务设置: {reusedTaskInfo?.taskName}
              </div>
              <Button
                color="success"
                size="sm"
                variant="solid"
                onPress={applyReusedSettings}
              >
                应用
              </Button>
              <Button
                color="default"
                size="sm"
                variant="light"
                onPress={ignoreReusedSettings}
              >
                忽略
              </Button>
            </div>
          )}
        </div>
        <div className="flex-shrink-0">
          <Button color="primary" variant="solid" onPress={onSettingsOpen}>
            ⚙️ 全局设置
          </Button>
        </div>
      </div>

      {/* 标签区域 */}
      <TagArea
        activeId={activeId}
        activeTag={activeTag}
        activeTagWidth={activeTagWidth}
        containerRef={containerRef}
        generateRandomColors={generateRandomColors}
        handleAddTag={handleAddTag}
        handleDragEnd={handleDragEnd}
        handleDragMove={handleDragMove}
        handleDragStart={handleDragStart}
        removeTag={removeTag}
        sensors={sensors}
        setShowAddForm={setShowAddForm}
        showAddForm={showAddForm}
        startEditTag={startEditTag}
        tags={tags}
        toggleTagVariable={toggleTagVariable}
      />

      {/* 操作按钮区域 */}
      <ActionButtons
        onClearAllTags={clearAllTags}
        onCreateBaseConfig={createBaseConfig}
        onDownloadConfig={handleDownloadConfig}
        onSubmit={handleSubmit}
        onUploadConfig={handleUploadConfig}
      />

      {/* 变量值区域 */}
      <VariableValueList
        tags={tags}
        variableValues={variableValues}
        onAddValue={addVariableValue}
        onDuplicateValue={duplicateVariableValue}
        onRemoveTag={removeTag}
        onRemoveValue={removeVariableValue}
        onReorderValues={handleReorderValues}
        onUpdateValue={updateVariableValue}
      />

      {/* 编辑标签模态窗口 */}
      <EditTagModal
        isOpen={isEditingTagModalOpen}
        tag={editingTag}
        tags={tags}
        onClose={() => {
          setEditingTag(null);
          onEditingTagModalClose();
        }}
        onSave={saveEditTag}
      />

      {/* 全局设置模态框 */}
      <SettingsModal
        globalSettings={globalSettings}
        isOpen={isSettingsOpen}
        setGlobalSettings={setGlobalSettings}
        onClose={onSettingsClose}
      />

      {/* 提交相关模态框组 */}
      <SubmitModals
        // 登录提示模态框
        isConfirmOpen={isConfirmOpen}
        isLoginTipOpen={isLoginTipOpen}
        isSecondConfirmOpen={isSecondConfirmOpen}
        isTaskNameModalOpen={isTaskNameModalOpen}
        setTaskName={setTaskName}
        taskName={taskName}
        totalImages={totalImages}
        onConfirmAccept={() => {
          if (totalImages > 50000) {
            // 如果超过50000张图片，显示错误
            return;
          } else if (totalImages > 1000) {
            // 如果超过1000张图片，需要二次确认
            onSecondConfirmOpen();
          } else {
            // 打开任务名称输入模态框
            onTaskNameModalOpen();
          }
        }}
        onConfirmClose={onConfirmClose}
        onConfirmOpen={onConfirmOpen}
        onGoToLogin={() => router.push("/login")}
        onLoginTipClose={onLoginTipClose}
        onSecondConfirmAccept={() => onTaskNameModalOpen()}
        onSecondConfirmClose={onSecondConfirmClose}
        onSubmit={proceedWithSubmission}
        onTaskNameModalClose={onTaskNameModalClose}
        onTaskNameModalOpen={onTaskNameModalOpen}
      />
    </div>
  );
};

export default DroppableTagsV2;
