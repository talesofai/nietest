import { useState, useRef, MutableRefObject } from "react";
import { Tag } from "@/types/tag";
import {
    useSensor,
    useSensors,
    MouseSensor,
    TouchSensor,
    KeyboardSensor,
    DragStartEvent,
    DragEndEvent,
    DragMoveEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { END_PLACEHOLDER_ID } from "../constants";

/**
 * 拖拽操作自定义Hook
 * 封装标签拖拽排序相关的状态和方法
 */
export const useDragAndDrop = (setTags: React.Dispatch<React.SetStateAction<Tag[]>>) => {
    // dnd-kit 状态
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeTagWidth, setActiveTagWidth] = useState<number | undefined>(undefined);

    // 容器引用
    const containerRef = useRef<HTMLDivElement>(null);

    // 初始位置引用
    const initialPositionRef = useRef<{ top: number, left: number, bottom: number } | null>(null);

    // 配置传感器
    const sensors = useSensors(
        useSensor(MouseSensor, {
            // 降低开始拖拽的阈值，使拖拽更容易触发
            activationConstraint: {
                distance: 4, // 4px 的移动就触发拖拽
            },
        }),
        useSensor(TouchSensor, {
            // 适配触摸设备
            activationConstraint: {
                delay: 250, // 触摸并保持 250ms 开始拖拽
                tolerance: 5, // 允许 5px 的移动容差
            },
        }),
        useSensor(KeyboardSensor)
    );

    // 处理拖拽开始
    const handleDragStart = (event: DragStartEvent) => {
        const id = event.active.id as string;
        setActiveId(id);

        // 使用event中的数据获取宽度
        const tagWidth = event.active.data.current?.width;
        if (tagWidth) {
            setActiveTagWidth(tagWidth);
        } else {
            // 如果没有数据，使用DOM查询方法
            const element = document.querySelector(`[data-tag-id="${id}"]`);
            if (element) {
                const rect = element.getBoundingClientRect();
                setActiveTagWidth(rect.width);

                // 记录元素初始位置
                initialPositionRef.current = {
                    top: rect.top,
                    left: rect.left,
                    bottom: rect.bottom
                };
            }
        }
    };

    // 处理拖拽移动
    const handleDragMove = (event: DragMoveEvent) => {
        // 如果没有容器引用、活动拖拽ID或初始位置，直接返回
        if (!containerRef.current || !activeId || !initialPositionRef.current) return;

        // 获取容器的边界信息
        const containerRect = containerRef.current.getBoundingClientRect();

        // 获取元素当前位置
        const activeElement = document.querySelector(`[data-tag-id="${activeId}"]`);
        if (!activeElement) return;

        // 计算元素当前的位置
        const elementRect = activeElement.getBoundingClientRect();

        // 计算垂直方向的移动距离
        const verticalMovement = elementRect.bottom - initialPositionRef.current.bottom;

        // 只有当向下移动且超出容器底部时，才标记为移动到末尾
        const isMovingDownOutOfBounds =
            verticalMovement > 0 && // 向下移动
            elementRect.bottom > containerRect.bottom + 20; // 超出容器底部

        // 如果向下移动且超出下边界，设置末尾移动标记
        if (isMovingDownOutOfBounds) {
            // 在这里不直接修改状态，而是通过DragOverlay的样式提示将要移动到末尾
            const dragOverlay = document.querySelector('[data-dnd-overlay]');
            if (dragOverlay) {
                // 给拖拽覆盖层添加一个"将移动到末尾"的提示样式
                dragOverlay.classList.add('moving-to-end');
            }
        } else {
            // 移除提示样式
            const dragOverlay = document.querySelector('[data-dnd-overlay]');
            if (dragOverlay) {
                dragOverlay.classList.remove('moving-to-end');
            }
        }
    };

    // 处理拖拽结束
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        // 清除状态
        setActiveId(null);
        setActiveTagWidth(undefined);
        initialPositionRef.current = null; // 清除初始位置

        // 获取当前指针位置
        const dragOverlay = document.querySelector('[data-dnd-overlay]');
        const isMovingToEnd = dragOverlay?.classList.contains('moving-to-end');

        // 移除样式
        if (dragOverlay) {
            dragOverlay.classList.remove('moving-to-end');
        }

        // 如果没有覆盖的元素，或者拖拽超出了下边界，移动到列表末尾
        if (!over || isMovingToEnd) {
            // 拖动到末尾，将标签移动到数组末尾
            setTags((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newItems = [...items];
                // 移除该项
                const [movedItem] = newItems.splice(oldIndex, 1);
                // 添加到末尾
                newItems.push(movedItem);
                return newItems;
            });
            return;
        }

        // 处理拖动到末尾占位符的情况
        if (over.id === END_PLACEHOLDER_ID) {
            // 拖动到末尾，将标签移动到数组末尾
            setTags((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newItems = [...items];
                // 移除该项
                const [movedItem] = newItems.splice(oldIndex, 1);
                // 添加到末尾
                newItems.push(movedItem);
                return newItems;
            });
            return;
        }

        // 正常的排序逻辑
        if (active.id !== over.id) {
            setTags((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);

                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    return {
        activeId,
        activeTagWidth,
        containerRef,
        sensors,
        handleDragStart,
        handleDragMove,
        handleDragEnd
    };
};