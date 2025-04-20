import React, { useRef } from "react";
import { Button } from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import { Tag } from "@/types/tag";
import {
    truncateText,
    getTypeDisplayName
} from "@/components/tags/draggable/tagUtils";

// dnd-kit 相关导入
import {
    DndContext,
    DragOverlay,
    MeasuringStrategy,
    defaultDropAnimationSideEffects,
    pointerWithin,
    rectIntersection,
    DragStartEvent,
    DragEndEvent,
    DragMoveEvent,
    SensorDescriptor
} from "@dnd-kit/core";
import {
    SortableContext,
    rectSortingStrategy
} from "@dnd-kit/sortable";

// 导入子组件
import AddTagForm from "./modals/AddTagForm";
import {
    SortableTagItem,
    END_PLACEHOLDER_ID,
    UserIcon
} from "../draggable";
import ColorButton from "@/components/ColorButton";

interface TagAreaProps {
    tags: Tag[];
    showAddForm: boolean;
    setShowAddForm: React.Dispatch<React.SetStateAction<boolean>>;
    generateRandomColors: () => void;
    handleAddTag: (data: any) => void;
    startEditTag: (tag: Tag) => void;
    removeTag: (id: string) => void;
    toggleTagVariable: (tag: Tag) => void;
    sensors: SensorDescriptor<any>[];
    containerRef: React.RefObject<HTMLDivElement>;
    handleDragStart: (event: DragStartEvent) => void;
    handleDragMove: (event: DragMoveEvent) => void;
    handleDragEnd: (event: DragEndEvent) => void;
    activeId: string | null;
    activeTag: Tag | null;
    activeTagWidth: number | undefined;
}

/**
 * 标签拖拽区域组件
 * 管理标签的展示、拖拽排序和添加操作
 */
const TagArea: React.FC<TagAreaProps> = ({
    tags,
    showAddForm,
    setShowAddForm,
    generateRandomColors,
    handleAddTag,
    startEditTag,
    removeTag,
    toggleTagVariable,
    sensors,
    containerRef,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    activeId,
    activeTag,
    activeTagWidth
}) => {
    // 自定义拖拽动画，禁用拉伸效果并保持原始样式
    const customDropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: {
                    opacity: '1',
                },
                dragOverlay: {
                    opacity: '1'
                }
            }
        })
    };

    // 渲染添加按钮或表单
    const renderAddTagButton = () => {
        return (
            <AnimatePresence mode="wait">
                {showAddForm ? (
                    <AddTagForm
                        onAdd={handleAddTag}
                        onCancel={() => setShowAddForm(false)}
                    />
                ) : (
                    <motion.div
                        key="add-button"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="inline-flex"
                    >
                        <Button
                            isIconOnly
                            size="md"
                            color="primary"
                            className="rounded-full shadow-md hover:shadow-lg h-[38px] min-w-[38px] flex items-center justify-center"
                            onPress={() => {
                                generateRandomColors();
                                setShowAddForm(true);
                            }}
                        >
                            <span className="text-xl font-medium">+</span>
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        );
    };

    return (
        <motion.div
            className="p-5 min-h-24 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            ref={containerRef}
        >
            <DndContext
                id="tags-drag-context"
                sensors={sensors}
                collisionDetection={(args) => {
                    const intersections = rectIntersection(args);
                    if (intersections && intersections.length > 0) {
                        return intersections;
                    }
                    return pointerWithin(args);
                }}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
                measuring={{
                    droppable: {
                        strategy: MeasuringStrategy.Always
                    }
                }}
            >
                <div className="flex flex-wrap gap-3 min-h-[2rem]">
                    {tags.length > 0 ? (
                        <SortableContext
                            items={[...tags.map(tag => tag.id), END_PLACEHOLDER_ID]}
                            strategy={rectSortingStrategy}
                        >
                            <div className="flex flex-wrap gap-3 w-full">
                                {tags.map((tag) => (
                                    <SortableTagItem
                                        key={tag.id}
                                        tag={tag}
                                        onEdit={() => startEditTag(tag)}
                                        onRemove={() => removeTag(tag.id)}
                                        onToggleVariable={() => toggleTagVariable(tag)}
                                    />
                                ))}

                                {/* 将加号按钮作为标签流的一部分紧跟在最后一个标签后面 */}
                                {!activeId && (
                                    <div className="inline-flex">
                                        {renderAddTagButton()}
                                    </div>
                                )}

                                {/* 末尾空白占位元素，提供末尾拖放区域，放在按钮后面 */}
                                <div
                                    id={END_PLACEHOLDER_ID}
                                    className="h-10 w-10 opacity-0"
                                    data-end-placeholder="true"
                                    style={{ minWidth: "40px" }}
                                />
                            </div>
                        </SortableContext>
                    ) : (
                        /* 当没有标签时，仍然显示加号按钮 */
                        !activeId && renderAddTagButton()
                    )}
                </div>

                {/* 拖拽覆盖层 - 显示正在拖拽的项目 */}
                <DragOverlay
                    adjustScale={false}
                    dropAnimation={customDropAnimation}
                >
                    {activeTag ? (
                        <div
                            className="shadow-lg inline-block"
                            style={{
                                whiteSpace: "nowrap",
                                ...(activeTagWidth ? { width: `${activeTagWidth}px` } : {})
                            }}
                        >
                            <ColorButton
                                hexColor={activeTag.color}
                                useGradient={activeTag.useGradient}
                                gradientToColor={activeTag.gradientToColor}
                                variant={activeTag.isVariable ? "shadow" : "solid"}
                                className="whitespace-nowrap"
                                startContent={(activeTag.type === "character" || activeTag.type === "element") && activeTag.header_img ? (
                                    <div className="h-6 w-6 flex-shrink-0 bg-transparent rounded-full overflow-hidden">
                                        <img
                                            src={activeTag.header_img}
                                            alt=""
                                            className="h-full w-full object-cover"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Crect width="40" height="40" fill="%23dddddd"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="12" fill="%23888888" text-anchor="middle" dominant-baseline="middle"%3E角色%3C/text%3E%3C/svg%3E';
                                            }}
                                        />
                                    </div>
                                ) : activeTag.isVariable && activeTag.type.includes("character") ? (
                                    <div className="h-6 w-6 flex-shrink-0 text-foreground">
                                        <UserIcon size={24} />
                                    </div>
                                ) : null}
                            >
                                {(() => {
                                    let text = "";
                                    if (activeTag.isVariable) {
                                        text = `${activeTag.name || ''} [变量]`;
                                    } else if (activeTag.type === "prompt") {
                                        text = truncateText(activeTag.value);
                                    } else if (activeTag.type === "character" || activeTag.type === "element") {
                                        text = truncateText(activeTag.value);
                                    } else {
                                        text = `${getTypeDisplayName(activeTag.type)}: ${truncateText(activeTag.value)}`;
                                    }

                                    // 如果有权重，显示权重信息
                                    if ((activeTag.type === "character" || activeTag.type === "element") && activeTag.weight !== undefined) {
                                        text += ` [权重: ${activeTag.weight}]`;
                                    }

                                    return text;
                                })()}
                            </ColorButton>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </motion.div>
    );
};

export default TagArea;