"use client";

import React, { useState, useEffect } from "react";
import { Input, Button, Tooltip } from "@heroui/react";

import { getXToken, setXToken, removeXToken, validateXToken } from "@/utils/vtokenService";
import { VTokenManagerProps } from "@/types/vtoken";

/**
 * 令牌管理组件
 * 提供令牌的设置、验证和显示功能
 */
const VTokenManager: React.FC<VTokenManagerProps> = ({
  onTokenChange,
  defaultExpanded = false,
}) => {
  const [token, setToken] = useState<string>("");
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [isValidating, setIsValidating] = useState<boolean>(false);

  // 初始化时从本地存储加载令牌
  useEffect(() => {
    const savedToken = getXToken();

    if (savedToken) {
      setToken(savedToken);
      setIsValid(true); // 假设本地存储的令牌是有效的
      onTokenChange?.(savedToken);
    }
  }, [onTokenChange]);

  // 保存并验证令牌
  const handleSaveToken = async () => {
    const trimmedToken = token.trim();

    // 如果令牌为空，则清除
    if (!trimmedToken) {
      handleClearToken();

      return;
    }

    setIsValidating(true);

    try {
      const isTokenValid = await validateXToken(trimmedToken);

      setIsValid(isTokenValid);

      if (isTokenValid) {
        setXToken(trimmedToken);
        onTokenChange?.(trimmedToken);
      } else {
        onTokenChange?.(null);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      // eslint-disable-next-line no-console
      console.error("验证令牌时出错:", error);
      setIsValid(false);
      onTokenChange?.(null);
    } finally {
      setIsValidating(false);
    }
  };

  // 清除令牌
  const handleClearToken = () => {
    setToken("");
    removeXToken();
    setIsValid(null);
    onTokenChange?.(null);
  };

  // 获取验证状态
  const validationStatus = {
    text: isValid === null ? "未验证" : isValid ? "已验证" : "无效",
    color: isValid === null ? "default" : isValid ? "success" : "danger",
  };

  return (
    <div className="w-full border rounded-md p-3 bg-default-50">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">令牌管理</h3>
        <Button
          className="min-w-0 px-2"
          size="sm"
          variant="light"
          onPress={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? "收起" : "展开"}
        </Button>
      </div>

      {isExpanded && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              aria-label="输入令牌"
              className="flex-grow"
              placeholder="输入您的x-token"
              size="sm"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <Tooltip content={`令牌状态: ${validationStatus.text}`}>
              <div className={`w-3 h-3 rounded-full bg-${validationStatus.color} self-center`} />
            </Tooltip>
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-grow"
              color="primary"
              isLoading={isValidating}
              size="sm"
              onPress={handleSaveToken}
            >
              {isValidating ? "验证中..." : "保存并验证"}
            </Button>
            <Button
              color="danger"
              isDisabled={isValidating}
              size="sm"
              variant="flat"
              onPress={handleClearToken}
            >
              清除
            </Button>
          </div>

          {isValid === false && (
            <div className="text-xs text-danger">令牌验证失败，请检查令牌是否正确</div>
          )}

          <div className="text-xs text-gray-500">
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>设置令牌后可以搜索更多内容</li>
              <li>令牌保存在浏览器本地，不会上传至服务器</li>
              <li>可以从APP中获取令牌，详见帮助文档</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default VTokenManager;
