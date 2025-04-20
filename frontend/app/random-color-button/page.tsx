"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader, Switch, Divider, Select, SelectItem, Slider } from "@heroui/react";
import { title, subtitle } from "@/components/primitives";
import RandomColorButton from "@/components/RandomColorButton";
import { getAllColorNames, baseColors, getRandomGradientColors } from "@/config/colors";

export default function RandomColorButtonDemo() {
    const [useGradient, setUseGradient] = useState(false);
    const [selectedVariant, setSelectedVariant] = useState("solid");
    const [isLoading, setIsLoading] = useState(false);
    const [colorBorder, setColorBorder] = useState(true);
    const [autoChange, setAutoChange] = useState(false);
    const [changeOnClick, setChangeOnClick] = useState(true);
    const [changeInterval, setChangeInterval] = useState(2000);

    // 示例渐变色（仅用于显示）
    const [gradientExamples, setGradientExamples] = useState<{ from: string; to: string }[]>([]);

    // 生成渐变色示例
    useEffect(() => {
        const examples = [];
        for (let i = 0; i < 6; i++) {
            examples.push(getRandomGradientColors());
        }
        setGradientExamples(examples);
    }, []);

    // 变体选项
    const variants = [
        { value: "solid", label: "Solid" },
        { value: "bordered", label: "Bordered" },
        { value: "light", label: "Light" },
        { value: "flat", label: "Flat" },
        { value: "faded", label: "Faded" },
        { value: "shadow", label: "Shadow" },
        { value: "ghost", label: "Ghost" }
    ];

    // 处理渐变开关变化
    const handleGradientToggle = () => {
        setUseGradient(!useGradient);
    };

    // 处理加载状态开关变化
    const handleLoadingToggle = () => {
        setIsLoading(!isLoading);
    };

    // 处理边框颜色开关变化
    const handleColorBorderToggle = () => {
        setColorBorder(!colorBorder);
    };

    // 处理自动变色开关变化
    const handleAutoChangeToggle = () => {
        setAutoChange(!autoChange);
    };

    // 处理点击变色开关变化
    const handleClickChangeToggle = () => {
        setChangeOnClick(!changeOnClick);
    };

    // 处理变体选择变化
    const handleVariantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedVariant(e.target.value);
    };

    // 处理变色间隔变化
    const handleIntervalChange = (value: number | number[]) => {
        setChangeInterval(typeof value === 'number' ? value : value[0]);
    };

    // 刷新渐变色示例
    const refreshGradientExamples = () => {
        const examples = [];
        for (let i = 0; i < 6; i++) {
            examples.push(getRandomGradientColors());
        }
        setGradientExamples(examples);
    };

    // 获取颜色列表
    const colorNames = getAllColorNames();

    return (
        <section className="flex flex-col items-center justify-center gap-8 py-8 md:py-10">
            <div className="inline-block max-w-2xl text-center justify-center">
                <h1 className={title()}>随机颜色按钮</h1>
                <p className={subtitle({ class: "mt-4" })}>
                    每次渲染或者根据设置随机选择颜色的按钮组件
                </p>
            </div>

            <Card className="w-full max-w-2xl">
                <CardHeader className="flex flex-col gap-1">
                    <h2 className="text-xl font-medium">组件配置</h2>
                    <p className="text-sm text-gray-500">
                        通过下方控件自定义随机颜色按钮的行为和样式
                    </p>
                </CardHeader>
                <CardBody className="flex flex-col gap-6">
                    <div className="flex items-center gap-2">
                        <Switch isSelected={useGradient} onValueChange={handleGradientToggle} />
                        <span className="text-sm">使用渐变效果</span>
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <Switch isSelected={autoChange} onValueChange={handleAutoChangeToggle} />
                            <span className="text-sm">自动变色</span>
                        </div>

                        {autoChange && (
                            <div className="flex flex-col gap-2 pl-6">
                                <label className="text-sm">变色间隔: {changeInterval}ms</label>
                                <Slider
                                    step={100}
                                    minValue={500}
                                    maxValue={5000}
                                    value={changeInterval}
                                    onChange={handleIntervalChange}
                                    className="max-w-md"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <Switch isSelected={changeOnClick} onValueChange={handleClickChangeToggle} />
                        <span className="text-sm">点击变色</span>
                    </div>

                    <Divider className="my-2" />

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">按钮变体</label>
                        <Select
                            placeholder="选择按钮变体"
                            selectedKeys={[selectedVariant]}
                            onChange={handleVariantChange}
                            className="max-w-xs"
                        >
                            {variants.map((variant) => (
                                <SelectItem key={variant.value}>
                                    {variant.label}
                                </SelectItem>
                            ))}
                        </Select>
                    </div>

                    <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                            <Switch isSelected={isLoading} onValueChange={handleLoadingToggle} />
                            <span className="text-sm">加载状态</span>
                        </div>

                        {selectedVariant === "bordered" && (
                            <div className="flex items-center gap-2">
                                <Switch isSelected={colorBorder} onValueChange={handleColorBorderToggle} />
                                <span className="text-sm">应用颜色到边框</span>
                            </div>
                        )}
                    </div>

                    <Divider className="my-2" />

                    <div className="flex flex-col gap-4">
                        <h3 className="text-md font-medium">预览</h3>
                        <div className="flex flex-wrap gap-4">
                            <RandomColorButton
                                useGradient={useGradient}
                                variant={selectedVariant as any}
                                radius="md"
                                isLoading={isLoading}
                                colorBorder={colorBorder}
                                autoChange={autoChange}
                                changeInterval={changeInterval}
                                changeOnClick={changeOnClick}
                                className="min-w-24"
                            >
                                随机颜色按钮
                            </RandomColorButton>

                            <RandomColorButton
                                useGradient={useGradient}
                                variant={selectedVariant as any}
                                radius="full"
                                isLoading={isLoading}
                                colorBorder={colorBorder}
                                autoChange={autoChange}
                                changeInterval={changeInterval}
                                changeOnClick={changeOnClick}
                                className="min-w-24"
                            >
                                圆形按钮
                            </RandomColorButton>

                            <RandomColorButton
                                useGradient={useGradient}
                                variant={selectedVariant as any}
                                radius="sm"
                                isIconOnly
                                isLoading={isLoading}
                                colorBorder={colorBorder}
                                autoChange={autoChange}
                                changeInterval={changeInterval}
                                changeOnClick={changeOnClick}
                            >
                                🔄
                            </RandomColorButton>
                        </div>
                    </div>
                </CardBody>
            </Card>

            <Card className="w-full max-w-2xl">
                <CardHeader className="flex flex-col gap-1">
                    <h2 className="text-xl font-medium">可用颜色</h2>
                    <p className="text-sm text-gray-500">
                        随机按钮会从以下颜色中随机选择
                    </p>
                </CardHeader>
                <CardBody className="flex flex-col gap-6">
                    <div className="flex flex-col gap-4">
                        <h3 className="text-md font-medium">基础颜色</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {colorNames.map(colorName => (
                                <div key={colorName} className="flex items-center gap-2">
                                    <div
                                        className="w-6 h-6 rounded-full border border-gray-200"
                                        style={{ backgroundColor: baseColors[colorName] }}
                                    />
                                    <span className="text-sm">{colorName}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {useGradient && (
                        <div className="flex flex-col gap-4 mt-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-md font-medium">渐变色示例</h3>
                                <button
                                    onClick={refreshGradientExamples}
                                    className="text-sm text-blue-500 hover:text-blue-700"
                                >
                                    刷新示例
                                </button>
                            </div>
                            <p className="text-sm text-gray-500">
                                渐变色由两个随机颜色组合生成，以下是一些可能的组合
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {gradientExamples.map((gradient, index) => (
                                    <div key={index} className="flex flex-col gap-1">
                                        <div
                                            className="w-full h-10 rounded border border-gray-200"
                                            style={{
                                                background: `linear-gradient(to right, ${gradient.from}, ${gradient.to})`
                                            }}
                                        />
                                        <div className="flex justify-between text-xs text-gray-500">
                                            <span>{gradient.from}</span>
                                            <span>{gradient.to}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardBody>
            </Card>

            <div className="text-center text-sm text-gray-500 max-w-lg">
                <p>使用示例：</p>
                <pre className="mt-2 text-left p-4 bg-gray-100 rounded-md overflow-x-auto">
                    {`<RandomColorButton
  useGradient={${useGradient}}
  variant="${selectedVariant}"
  ${isLoading ? 'isLoading={true}' : ''}
  ${selectedVariant === 'bordered' && !colorBorder ? 'colorBorder={false}' : ''}
  autoChange={${autoChange}}
  ${autoChange ? `changeInterval={${changeInterval}}` : ''}
  changeOnClick={${changeOnClick}}
>
  随机颜色按钮
</RandomColorButton>`}
                </pre>
            </div>
        </section>
    );
}