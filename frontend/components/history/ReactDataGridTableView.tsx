import React, { useState, useEffect, useRef } from "react";
// 使用require导入react-data-grid
const ReactDataGrid = require("react-data-grid");
import { Icon } from "@iconify/react";
import { Button } from "@heroui/react";

// 确保导入CSS
// 使用相对路径导入CSS
import "@/styles/react-data-grid.css";

// 图片URL处理函数
const getResizedImageUrl = (url: string, size: number): string => {
  if (!url) return url;
  if (url.includes("x-oss-process=")) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}x-oss-process=image/resize,l_${size}/quality,q_80/format,webp`;
};

// 定义表格数据接口
interface TableCellData {
  url: string;
  urls?: string[];
  xValue: string;
  yValue: string;
  hasValidImage: boolean;
}

interface ReactDataGridTableViewProps {
  tableData: any[];
  columnValues: string[];
  xAxis: string | null;
  yAxis: string | null;
  tableScale: number;
  hasBatchTag: boolean;
  onViewImage: (url: string, title: string) => void;
  onViewMultipleImages: (urls: string[], title: string) => void;
}

// 懒加载图片组件
const LazyImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}> = ({ src, alt, className, style, onClick }) => {
  const imgRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  // 加载失败处理
  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  return (
    <div
      ref={imgRef}
      className={`relative ${className || ''}`}
      style={style}
      onClick={onClick}
    >
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-default-50">
          <Icon icon="solar:refresh-linear" className="animate-spin text-default-400" width={24} />
        </div>
      )}

      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-default-50 text-xs text-default-500">
          <div className="text-center">
            <Icon icon="solar:danger-triangle-linear" className="w-5 h-5 mx-auto mb-1 text-danger" />
            <span>图片加载失败</span>
          </div>
        </div>
      )}

      {isInView && !hasError && (
        <img
          alt={alt}
          className={isLoaded ? "opacity-100 max-w-full max-h-full" : "opacity-0"}
          src={src}
          style={{
            objectFit: "contain",
            width: "auto",
            height: "auto",
            transition: "opacity 0.2s ease",
          }}
          onError={handleError}
          onLoad={() => setIsLoaded(true)}
        />
      )}
    </div>
  );
};

export const ReactDataGridTableView: React.FC<ReactDataGridTableViewProps> = ({
  tableData,
  columnValues,
  xAxis,
  yAxis,
  tableScale,
  hasBatchTag,
  onViewImage,
  onViewMultipleImages,
}) => {
  // 表格容器引用
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // 获取网格列数
  const getGridColumns = (imageCount: number): string => {
    if (imageCount <= 1) return "grid-cols-1";
    if (imageCount <= 4) return "grid-cols-2";
    if (imageCount <= 9) return "grid-cols-3";
    if (imageCount <= 16) return "grid-cols-4";
    return "grid-cols-5";
  };

  // 根据批次图片数量确定图片尺寸
  const getImageSizeByBatchCount = (imageCount: number): number => {
    if (imageCount <= 1) return 720;
    if (imageCount <= 4) return 360;
    if (imageCount <= 9) return 240;
    if (imageCount <= 16) return 180;
    return 120;
  };

  // 定义表格列
  const columns = [
    // 第一列 - 行标题
    {
      key: "rowTitle",
      name: xAxis && yAxis
        ? `${xAxis} / ${yAxis}`
        : xAxis
          ? `${xAxis}`
          : yAxis
            ? `${yAxis}`
            : "",
      width: 80,
      resizable: true,
      sortable: true,
      formatter: (props: any) => {
        const row = props.value || props.row;
        return (
          <div className="w-full text-center px-2 font-medium" title={row.rowTitle}>
            {((row.rowTitle as string) || "").length > 8
              ? `${(row.rowTitle as string).substring(0, 8)}...`
              : row.rowTitle as string}
          </div>
        );
      }
    },
    // 动态生成数据列
    ...columnValues.map((colKey) => ({
      key: colKey,
      name: colKey.length > 8 ? `${colKey.substring(0, 8)}...` : colKey,
      width: 180,
      resizable: true,
      formatter: (props: any) => {
        const row = props.value || props.row;
        const cell = row[colKey] as TableCellData;
        if (!cell) return null;

        const imageUrl = cell.hasValidImage ? cell.url : "";
        const cellTitle = `${row.rowTitle}-${colKey}`;

        if (cell.hasValidImage) {
          // 有图片的单元格
          return (
            <div className="w-full h-full">
              {cell.urls && cell.urls.length > 1 && hasBatchTag ? (
                // 多图显示网格
                <div
                  className={`grid gap-1 ${getGridColumns(cell.urls.length)} w-full h-full bg-default-50 overflow-hidden`}
                  style={{ gridAutoRows: "1fr" }}
                >
                  {cell.urls.map((url, index) => (
                    <div
                      key={index}
                      className="relative overflow-hidden cursor-pointer bg-default-50"
                      role="button"
                      tabIndex={0}
                    >
                      <div className="w-full h-full flex items-center justify-center">
                        <LazyImage
                          alt={`${cellTitle} - 批次 ${index + 1}`}
                          className="max-w-full max-h-full"
                          src={getResizedImageUrl(
                            url,
                            getImageSizeByBatchCount(cell.urls?.length || 1)
                          )}
                          onClick={() => onViewImage(url, `${cellTitle} - 批次 ${index + 1}`)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // 单图显示
                <div
                  className="w-full h-full bg-default-50 overflow-hidden cursor-pointer"
                  role="button"
                  tabIndex={0}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <LazyImage
                      alt={cellTitle}
                      className="max-w-full max-h-full"
                      src={getResizedImageUrl(imageUrl, getImageSizeByBatchCount(1))}
                      onClick={() => {
                        cell.urls && cell.urls.length > 0
                          ? onViewMultipleImages(cell.urls, cellTitle)
                          : onViewImage(imageUrl, cellTitle);
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        } else {
          // 无图片的单元格
          return (
            <div className="w-full h-full">
              <div className="w-full h-full flex items-center justify-center bg-default-50 overflow-hidden">
                <div className="text-center p-4">
                  <div className="flex flex-col items-center">
                    <Icon icon="solar:missing-circular-linear" className="w-8 h-8 text-default-300 mb-2" />
                    <p className="text-default-500 text-sm font-medium">未找到图片</p>
                    <div className="mt-2 text-default-400 text-xs space-y-1">
                      {xAxis && (
                        <p title={`${xAxis}:${cell?.xValue || colKey.replace(/#\d+$/, "")}`}>
                          {(() => {
                            const text = `${xAxis}:${cell?.xValue || colKey.replace(/#\d+$/, "")}`;
                            return text.length > 8 ? `${text.substring(0, 8)}...` : text;
                          })()}
                        </p>
                      )}
                      {yAxis && (
                        <p title={`${yAxis}:${cell?.yValue || row.rowTitle.replace(/#\d+$/, "")}`}>
                          {(() => {
                            const text = `${yAxis}:${cell?.yValue || row.rowTitle.replace(/#\d+$/, "")}`;
                            return text.length > 8 ? `${text.substring(0, 8)}...` : text;
                          })()}
                        </p>
                      )}
                      <p className="text-default-300 mt-1">无匹配数据</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        }
      },
    })),
  ];

  return (
    <div className="flex flex-col h-full">
      <div
        ref={tableContainerRef}
        className="rdg-wrapper flex-1 overflow-auto"
        style={{
          transform: `scale(${tableScale / 100})`,
          transformOrigin: "top left",
          transition: "transform 0.2s ease",
          width: "100%",
          height: "100%",
        }}
      >
        <ReactDataGrid
          columns={columns}
          rowGetter={i => tableData[i]}
          rowsCount={tableData.length}
          rowHeight={180}
          minHeight={500}
          className="rdg-light"
        />
      </div>

      {/* 表格信息显示 */}
      <div className="p-2 bg-default-50 border-t border-default-200 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-default-600">
            共 {tableData.length} 行
          </span>
        </div>
      </div>
    </div>
  );
};

export default ReactDataGridTableView;
