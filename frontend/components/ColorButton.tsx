import { Button, ButtonProps } from "@heroui/react";
import { useMemo } from "react";

// ColorButton 组件的属性接口，继承自 ButtonProps
type ColorButtonProps = ButtonProps & {
    /**
     * 十六进制颜色代码，例如: "#FF5733"
     */
    hexColor?: string;

    /**
     * 是否使用渐变效果
     */
    useGradient?: boolean;

    /**
     * 渐变的第二种颜色（仅在 useGradient 为 true 时生效）
     */
    gradientToColor?: string;

    /**
     * 是否应用颜色到边框（适用于 bordered 变体）
     */
    colorBorder?: boolean;
};

/**
 * 一个自定义的按钮组件，允许通过十六进制颜色代码自定义按钮的背景色，
 * 同时保留 HeroUI Button 的所有原有功能
 */
const ColorButton = ({
    hexColor = "#3B82F6", // 默认为蓝色
    useGradient = false,
    gradientToColor,
    className = "",
    variant = "solid", // 与 HeroUI Button 默认值保持一致
    colorBorder = true,
    children,
    ...props
}: ColorButtonProps) => {
    // 验证十六进制颜色代码格式
    const isValidHexColor = useMemo(() => {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hexColor);
    }, [hexColor]);

    // 验证渐变色的十六进制颜色代码格式
    const isValidGradientColor = useMemo(() => {
        if (!gradientToColor) return false;
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(gradientToColor);
    }, [gradientToColor]);

    // 计算样式对象
    const buttonStyle = useMemo(() => {
        if (!isValidHexColor) {
            console.warn("无效的十六进制颜色代码。使用默认颜色。");
            return {};
        }

        const style: Record<string, string> = {};

        // 根据变体类型应用不同的样式
        switch (variant) {
            case "solid":
                if (useGradient && isValidGradientColor && gradientToColor) {
                    style.background = `linear-gradient(to right top, ${hexColor}, ${gradientToColor})`;
                } else {
                    style.backgroundColor = hexColor;
                }
                break;

            case "bordered":
                if (colorBorder) {
                    style.borderColor = hexColor;
                    style.color = hexColor;
                }
                break;

            case "light":
            case "flat":
            case "faded":
                // 为这些半透明背景的变体设置颜色
                style.backgroundColor = `${hexColor}20`; // 添加透明度
                style.color = hexColor;
                break;

            case "ghost":
                // Ghost 只在悬停时显示背景色
                style.color = hexColor;
                break;

            case "shadow":
                if (useGradient && isValidGradientColor && gradientToColor) {
                    style.background = `linear-gradient(to right top, ${hexColor}, ${gradientToColor})`;
                } else {
                    style.backgroundColor = hexColor;
                }
                style.boxShadow = `0 4px 14px 0 ${hexColor}aa`;
                break;

            default:
                if (useGradient && isValidGradientColor && gradientToColor) {
                    style.background = `linear-gradient(to right top, ${hexColor}, ${gradientToColor})`;
                } else {
                    style.backgroundColor = hexColor;
                }
        }

        return style;
    }, [hexColor, useGradient, gradientToColor, isValidHexColor, isValidGradientColor, variant, colorBorder]);

    // 构造基础样式类，保留原始样式并添加文本颜色
    // 为 solid 和 shadow 变体添加白色文本
    const isLightTextVariant = variant === "solid" || variant === "shadow";
    const buttonClassName = `${isLightTextVariant ? "text-white" : ""} ${className}`;

    return (
        <Button
            className={buttonClassName}
            style={buttonStyle}
            variant={variant}
            {...props}
        >
            {children}
        </Button>
    );
};

export default ColorButton;