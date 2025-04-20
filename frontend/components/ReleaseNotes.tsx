"use client";

import React from 'react';
import { Accordion, AccordionItem } from "@heroui/react";

/**
 * 发布说明组件
 * 用于显示应用版本更新信息
 */
const ReleaseNotes = () => {
    return (
        <div className="max-w-3xl mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">发布说明</h1>

            <Accordion>
                <AccordionItem
                    key="v1.2.0"
                    title={
                        <div className="flex justify-between items-center">
                            <span className="font-bold">v1.2.0</span>
                            <span className="text-xs text-default-500">2023-09-15</span>
                        </div>
                    }
                >
                    <div className="py-2 space-y-3">
                        <div>
                            <h3 className="text-lg font-semibold mb-1">API 接口优化</h3>
                            <ul className="list-disc pl-5 space-y-1 text-sm">
                                <li>更新标签数据接口，符合后端文档规范</li>
                                <li>添加变量标准化结构，使用v0-v6作为变量槽位</li>
                                <li>优化搜索结果格式，规范化返回数据结构</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold mb-1">变量功能增强</h3>
                            <ul className="list-disc pl-5 space-y-1 text-sm">
                                <li>支持为变量添加多个值</li>
                                <li>新增变量值权重设置功能</li>
                                <li>优化character和element类型的变量支持</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold mb-1">UI 改进</h3>
                            <ul className="list-disc pl-5 space-y-1 text-sm">
                                <li>搜索结果展示优化，使用header_img替代avatar_img</li>
                                <li>标签显示格式优化，增加权重显示</li>
                                <li>变量编辑体验优化</li>
                            </ul>
                        </div>
                    </div>
                </AccordionItem>

                <AccordionItem
                    key="v1.1.0"
                    title={
                        <div className="flex justify-between items-center">
                            <span className="font-bold">v1.1.0</span>
                            <span className="text-xs text-default-500">2023-08-28</span>
                        </div>
                    }
                >
                    <div className="py-2 space-y-3">
                        <div>
                            <h3 className="text-lg font-semibold mb-1">新功能</h3>
                            <ul className="list-disc pl-5 space-y-1 text-sm">
                                <li>增加标签拖拽排序功能</li>
                                <li>新增标签变量功能</li>
                                <li>支持角色和元素搜索</li>
                            </ul>
                        </div>
                    </div>
                </AccordionItem>
            </Accordion>
        </div>
    );
};

export default ReleaseNotes;