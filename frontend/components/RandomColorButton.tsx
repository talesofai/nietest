import { ButtonProps } from "@heroui/react";
import { useState, useEffect, useCallback } from "react";

import ColorButton from "./ColorButton";

import { getRandomColorValue, getRandomGradientColors } from "@/config/colors";

// RandomColorButton 组件的属性接口，继承自 ButtonProps
type RandomColorButtonProps = Omit<ButtonProps, "color"> & {
  /**
   * 是否使用渐变效果
   */
  useGradient?: boolean;

  /**
   * 是否应用颜色到边框（适用于 bordered 变体）
   */
  colorBorder?: boolean;

  /**
   * 是否自动变色
   */
  autoChange?: boolean;

  /**
   * 自动变色的时间间隔（毫秒），默认为 2000ms
   */
  changeInterval?: number;

  /**
   * 点击时是否变色
   */
  changeOnClick?: boolean;
};

/**
 * 一个随机颜色按钮组件，每次渲染或者根据设置会随机选择一个颜色
 * 可以设置自动变色、点击变色等功能
 */
const RandomColorButton = ({
  useGradient = false,
  className = "",
  variant = "solid",
  colorBorder = true,
  autoChange = false,
  changeInterval = 2000,
  changeOnClick = false,
  onClick,
  children,
  ...props
}: RandomColorButtonProps) => {
  // 状态管理随机颜色
  const [hexColor, setHexColor] = useState<string>("");
  const [gradientToColor, setGradientToColor] = useState<string>("");

  // 生成随机颜色的函数
  const generateRandomColors = useCallback(() => {
    if (useGradient) {
      const gradient = getRandomGradientColors();

      setHexColor(gradient.from);
      setGradientToColor(gradient.to);
    } else {
      setHexColor(getRandomColorValue());
    }
  }, [useGradient]);

  // 组件挂载时生成初始随机颜色
  useEffect(() => {
    generateRandomColors();
  }, [generateRandomColors]);

  // 处理自动变色
  useEffect(() => {
    if (!autoChange) return;

    const intervalId = setInterval(() => {
      generateRandomColors();
    }, changeInterval);

    return () => clearInterval(intervalId);
  }, [autoChange, changeInterval, generateRandomColors]);

  // 处理点击事件
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (changeOnClick) {
      generateRandomColors();
    }

    if (onClick) {
      onClick(e);
    }
  };

  return (
    <ColorButton
      className={className}
      colorBorder={colorBorder}
      gradientToColor={gradientToColor}
      hexColor={hexColor}
      useGradient={useGradient}
      variant={variant}
      onClick={handleClick}
      {...props}
    >
      {children}
    </ColorButton>
  );
};

export default RandomColorButton;
