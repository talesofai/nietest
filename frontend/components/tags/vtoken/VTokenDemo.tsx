"use client";

import React, { useState } from "react";
import { Card, CardBody, CardHeader, Divider, Button } from "@heroui/react";
import VTokenDisplay from "@/components/tags/vtoken/VTokenDisplay";
import VTokenManager from "@/components/tags/vtoken/VTokenManager";
import VTokenSelector from "@/components/tags/vtoken/VTokenSelector";
import { SearchSelectItem } from "@/types/search";

/**
 * VToken组件库演示组件
 * 展示各组件的功能和用法
 */
const VTokenDemo: React.FC = () => {
    const [selectedCharacter, setSelectedCharacter] = useState<SearchSelectItem | null>(null);
    const [selectedElement, setSelectedElement] = useState<SearchSelectItem | null>(null);
    const [tokenValid, setTokenValid] = useState<boolean | null>(null);

    const handleTokenChange = (token: string | null) => {
        console.log("Token changed:", token ? "Token set" : "Token cleared");
        setTokenValid(!!token);
    };

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-8">
            <h1 className="text-2xl font-bold text-center">VToken 组件库演示</h1>

            <section>
                <h2 className="text-xl font-semibold mb-4">1. 令牌管理 (VTokenManager)</h2>
                <Card>
                    <CardBody>
                        <VTokenManager
                            onTokenChange={handleTokenChange}
                            defaultExpanded={true}
                        />
                        <div className="mt-4 text-sm text-gray-500">
                            令牌状态: {tokenValid === null ? "未设置" : (tokenValid ? "有效" : "无效")}
                        </div>
                    </CardBody>
                </Card>
            </section>

            <section>
                <h2 className="text-xl font-semibold mb-4">2. 令牌显示 (VTokenDisplay)</h2>
                <Card>
                    <CardHeader>
                        <h3 className="text-md font-medium">不同样式的令牌显示</h3>
                    </CardHeader>
                    <CardBody className="space-y-3">
                        <VTokenDisplay
                            name="测试角色"
                            type="character"
                            header_img="https://via.placeholder.com/150"
                            onClose={() => alert("关闭按钮点击")}
                        />

                        <VTokenDisplay
                            name="无图像角色"
                            type="character"
                        />

                        <VTokenDisplay
                            name="测试元素"
                            type="element"
                            header_img="https://via.placeholder.com/150"
                        />
                    </CardBody>
                </Card>
            </section>

            <section>
                <h2 className="text-xl font-semibold mb-4">3. 令牌选择器 (VTokenSelector)</h2>
                <Card>
                    <CardHeader>
                        <h3 className="text-md font-medium">角色选择</h3>
                    </CardHeader>
                    <CardBody>
                        <div className="space-y-4">
                            <VTokenSelector
                                type="character"
                                name={selectedCharacter?.name}
                                header_img={selectedCharacter?.header_img}
                                onChange={(value) => console.log("Selected character:", value)}
                                onSelectItem={(item) => {
                                    console.log("Selected character item:", item);
                                    setSelectedCharacter(item);
                                }}
                            />

                            {selectedCharacter && (
                                <div className="text-sm">
                                    <div>已选择角色： {selectedCharacter.name}</div>
                                    <div>UUID: {selectedCharacter.uuid}</div>
                                    <div>热度: {selectedCharacter.heat_score}</div>
                                    <Button
                                        size="sm"
                                        color="danger"
                                        variant="flat"
                                        className="mt-2"
                                        onPress={() => setSelectedCharacter(null)}
                                    >
                                        清除选择
                                    </Button>
                                </div>
                            )}

                            <Divider className="my-4" />

                            <h3 className="text-md font-medium">元素选择</h3>
                            <VTokenSelector
                                type="element"
                                name={selectedElement?.name}
                                header_img={selectedElement?.header_img}
                                onChange={(value) => console.log("Selected element:", value)}
                                onSelectItem={(item) => {
                                    console.log("Selected element item:", item);
                                    setSelectedElement(item);
                                }}
                            />

                            {selectedElement && (
                                <div className="text-sm">
                                    <div>已选择元素： {selectedElement.name}</div>
                                    <div>UUID: {selectedElement.uuid}</div>
                                    <div>热度: {selectedElement.heat_score}</div>
                                    <Button
                                        size="sm"
                                        color="danger"
                                        variant="flat"
                                        className="mt-2"
                                        onPress={() => setSelectedElement(null)}
                                    >
                                        清除选择
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardBody>
                </Card>
            </section>
        </div>
    );
};

export default VTokenDemo;