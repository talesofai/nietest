"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
  Input,
  Card,
  Spinner,
  Pagination,
} from "@heroui/react";

import { SearchResultItem, SearchSelectItem } from "@/types/search";
import { HeartFilledIcon, SearchIcon, CloseIcon } from "@/components/icons";
import {
  searchCharacterOrElement,
  getPlaceholderSvg,
} from "@/utils/vtokenService";

/**
 * 令牌搜索类型
 */
export type VTokenSearchType = "character" | "element";

/**
 * 令牌搜索模态框属性
 */
interface VTokenSearchModalProps {
  /** 模态框是否打开 */
  isOpen: boolean;
  /** 关闭模态框回调 */
  onClose: () => void;
  /** 选择项目回调 */
  onSelect: (item: SearchSelectItem) => void;
  /** 搜索类型 */
  type: VTokenSearchType;
}

/**
 * 搜索类型配置
 */
const TYPE_CONFIG = {
  character: {
    title: "角色搜索",
    placeholder: "输入角色名称关键词",
    emptyText: "未找到相关角色，请尝试其他关键词",
    apiType: "oc",
  },
  element: {
    title: "元素搜索",
    placeholder: "输入元素名称关键词",
    emptyText: "未找到相关元素，请尝试其他关键词",
    apiType: "elementum",
  },
};

/**
 * 每页显示项目数
 */
const PAGE_SIZE = 12;

/**
 * 通用令牌搜索模态框组件
 * 可以搜索角色或元素
 */
const VTokenSearchModal: React.FC<VTokenSearchModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  type,
}) => {
  // 状态定义
  const [keyword, setKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFirstSearch, setIsFirstSearch] = useState(true);

  // 类型特定配置
  const config = useMemo(() => TYPE_CONFIG[type], [type]);

  // 搜索处理函数
  const doSearch = useCallback(
    async (searchKeyword: string, pageIndex: number) => {
      if (!searchKeyword.trim()) return;

      setIsLoading(true);
      setErrorMessage(null);

      try {
        // API页码从0开始，UI从1开始
        const apiPageIndex = pageIndex - 1;

        const response = await searchCharacterOrElement(
          searchKeyword,
          apiPageIndex,
          PAGE_SIZE,
          config.apiType as any,
        );

        if (response.data) {
          setSearchResults(response.data);
          setTotalPages(response.metadata?.total_page_size || 1);
          setTotalResults(response.metadata?.total_size || 0);
        } else if (response.error) {
          setErrorMessage(
            `搜索${type === "character" ? "角色" : "元素"}失败: ${response.error}`,
          );
          setSearchResults([]);
          setTotalPages(1);
          setTotalResults(0);
        } else {
          // 空结果
          setSearchResults([]);
          setTotalPages(1);
          setTotalResults(0);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          `搜索${type === "character" ? "角色" : "元素"}失败:`,
          error,
        );
        setErrorMessage(`搜索失败，请稍后重试`);
        setSearchResults([]);
        setTotalPages(1);
        setTotalResults(0);
      } finally {
        setIsLoading(false);
      }
    },
    [config.apiType, type],
  );

  // 确保总页数有效
  useEffect(() => {
    if (isNaN(totalPages) || totalPages <= 0) {
      setTotalPages(1);
    }
  }, [totalPages]);

  // 搜索按钮处理函数
  const handleSearch = useCallback(() => {
    if (!keyword.trim()) return;

    setPage(1);
    setIsFirstSearch(false);
    doSearch(keyword, 1);
  }, [keyword, doSearch]);

  // 键盘事件处理
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleSearch();
      }
    },
    [handleSearch],
  );

  // 换页处理
  const handlePageChange = useCallback(
    (newPage: number) => {
      if (isLoading) return;

      // 确保页码有效
      const safePage = Math.max(1, Math.min(newPage, Math.max(1, totalPages)));

      if (safePage !== page) {
        setPage(safePage);
        doSearch(keyword, safePage);
      }
    },
    [isLoading, totalPages, page, keyword, doSearch],
  );

  // 选择项目
  const handleSelectItem = useCallback(
    (item: SearchResultItem) => {
      const selectItem: SearchSelectItem = {
        uuid: item.uuid,
        name: item.name,
        type: item.type,
        heat_score: item.heat_score,
        header_img: item.header_img,
      };

      onSelect(selectItem);
      onClose();
    },
    [onSelect, onClose],
  );

  // 分页信息
  const paginationInfo = useMemo(() => {
    if (isLoading) return "正在加载...";
    if (totalResults === 0 && !isFirstSearch) return "暂无结果";
    if (isFirstSearch) return "输入关键词开始搜索";

    return `共 ${totalResults} 个结果，当前第 ${page}/${totalPages} 页`;
  }, [isLoading, totalResults, isFirstSearch, page, totalPages]);

  // 图片加载错误处理
  const handleImageError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      (e.target as HTMLImageElement).src = getPlaceholderSvg(type);
    },
    [type],
  );

  return (
    <Modal
      hideCloseButton
      classNames={{
        base: "max-w-5xl h-[760px]",
        body: "p-0",
        header: "py-4 px-6",
        wrapper: "pt-[18px] pb-[18px]",
      }}
      isOpen={isOpen}
      size="3xl"
      onOpenChange={onClose}
    >
      <ModalContent>
        {(onModalClose: () => void) => (
          <>
            <ModalHeader className="flex justify-between items-center">
              <div className="text-xl font-medium">{config.title}</div>
              <Button
                isIconOnly
                className="text-foreground text-xl p-2 min-w-0 w-auto h-auto rounded-full"
                variant="light"
                onPress={onModalClose}
              >
                <CloseIcon height={18} width={18} />
              </Button>
            </ModalHeader>
            <ModalBody className="p-4">
              <div className="flex flex-col h-full space-y-4">
                {/* 搜索区域 */}
                <div className="flex gap-2 flex-shrink-0 mt-2">
                  <Input
                    className="flex-grow"
                    placeholder={config.placeholder}
                    size="sm"
                    startContent={
                      <SearchIcon className="text-default-400 flex-shrink-0" />
                    }
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <Button color="primary" size="sm" onPress={handleSearch}>
                    搜索
                  </Button>
                </div>

                {/* 错误信息 */}
                {errorMessage && (
                  <div className="text-danger text-sm">{errorMessage}</div>
                )}

                {/* 内容区域 */}
                <div className="flex-grow h-[500px] overflow-y-auto relative">
                  {/* 加载状态 */}
                  {isLoading && (
                    <div className="absolute inset-0 bg-background/50 flex justify-center items-center z-10">
                      <Spinner color="primary" label="正在搜索..." />
                    </div>
                  )}

                  {/* 搜索结果 */}
                  {searchResults.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {searchResults.map((item, index) => (
                        <Card
                          key={`${item.uuid}-${index}`}
                          isPressable
                          className="overflow-hidden"
                          onPress={() => handleSelectItem(item)}
                        >
                          {/* 图片容器 */}
                          <div
                            className="w-full relative overflow-hidden bg-gray-100"
                            style={{ paddingBottom: "133.33%" }}
                          >
                            <img
                              alt={item.name}
                              className="w-full h-full object-cover absolute inset-0"
                              src={item.header_img || getPlaceholderSvg(type)}
                              style={{ objectPosition: "center" }}
                              onError={handleImageError}
                            />

                            {/* 热度标签 */}
                            {item.heat_score > 0 && (
                              <div className="absolute top-1 right-1 bg-black/50 text-white px-1 rounded-sm flex items-center text-xs z-10">
                                <HeartFilledIcon
                                  className="text-danger mr-1"
                                  height={10}
                                  width={10}
                                />
                                {item.heat_score}
                              </div>
                            )}
                          </div>

                          {/* 名称 */}
                          <div className="p-2 text-center">
                            <span
                              className="text-sm font-medium truncate block"
                              title={item.name}
                            >
                              {item.name}
                            </span>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    /* 无结果提示 */
                    !isLoading &&
                    keyword &&
                    !isFirstSearch && (
                      <div className="flex flex-col justify-center items-center h-full text-center">
                        <div className="text-gray-400 mb-2">
                          {errorMessage || config.emptyText}
                        </div>
                        <div className="text-gray-400 text-xs">
                          {errorMessage && errorMessage.includes("请先登录")
                            ? "请登录后再尝试搜索，登录后可获取更多内容"
                            : "提示：若首次搜索未返回结果，可能需要刷新页面"}
                        </div>
                      </div>
                    )
                  )}
                </div>

                {/* 分页区域 */}
                <div className="flex flex-col items-center mt-4 flex-shrink-0 py-2">
                  <div className="text-xs text-gray-500 mb-2">
                    {paginationInfo}
                  </div>

                  {searchResults.length > 0 && totalPages > 1 && (
                    <Pagination
                      isCompact
                      showControls
                      boundaries={1}
                      color="primary"
                      isDisabled={isLoading}
                      page={page}
                      siblings={1}
                      total={totalPages}
                      onChange={handlePageChange}
                    />
                  )}
                </div>
              </div>
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default VTokenSearchModal;

/**
 * 角色搜索模态框组件
 * 封装了VTokenSearchModal，固定type为character
 */
export const CharacterSearchModal: React.FC<
  Omit<VTokenSearchModalProps, "type">
> = (props) => <VTokenSearchModal {...props} type="character" />;

/**
 * 元素搜索模态框组件
 * 封装了VTokenSearchModal，固定type为element
 */
export const ElementSearchModal: React.FC<
  Omit<VTokenSearchModalProps, "type">
> = (props) => <VTokenSearchModal {...props} type="element" />;
