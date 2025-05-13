import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    useReactTable,
    getSortedRowModel,
    SortingState,
} from "@tanstack/react-table";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useVirtualizer } from "@tanstack/react-virtual";

// 图片URL处理函数
const getResizedImageUrl = (url: string, size: number): string => {
    if (!url) return url;
    if (url.includes("x-oss-process=")) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}x-oss-process=image/resize,l_${size}/quality,q_80/format,webp`;
};

// 占位图片URL
const PLACEHOLDER_IMAGE_URL = "/placeholder-image.png";

// 定义表格数据接口
interface TableCellData {
    url: string;
    urls?: string[];
    xValue: string;
    yValue: string;
    hasValidImage: boolean;
}

interface MatrixTableViewProps {
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

export const MatrixTableView: React.FC<MatrixTableViewProps> = ({
    tableData,
    columnValues,
    xAxis,
    yAxis,
    tableScale,
    hasBatchTag,
    onViewImage,
    onViewMultipleImages,
}) => {
    // 启动时输出列数据以便调试
    useEffect(() => {
        if (process.env.NODE_ENV === "development") {
            console.log("表格列数据:", {
                columnValuesLength: columnValues.length,
                columnValues: columnValues
            });
        }
    }, [columnValues]);

    // 表格状态
    const [sorting, setSorting] = useState<SortingState>([]);
    const [useVirtualization, setUseVirtualization] = useState(false); // 默认关闭虚拟滚动

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

    // 列帮助器
    const columnHelper = createColumnHelper<any>();

    // 定义表格列
    const columns = useMemo(() => {
        const cols = [
            // 第一列 - 行标题
            columnHelper.accessor("rowTitle", {
                id: "rowTitle",
                header: () => (
                    <div className="w-full text-center px-2">
                        {xAxis && yAxis
                            ? `${xAxis} / ${yAxis}`
                            : xAxis
                                ? `${xAxis}`
                                : yAxis
                                    ? `${yAxis}`
                                    : ""}
                    </div>
                ),
                cell: ({ getValue }) => (
                    <div className="w-full text-center px-2 font-medium" title={getValue() as string}>
                        {((getValue() as string) || "").length > 8
                            ? `${(getValue() as string).substring(0, 8)}...`
                            : getValue() as string}
                    </div>
                ),
                size: 80, // 设置列宽
                enableSorting: true,
                sortingFn: "alphanumeric",
            }),
        ];

        // 添加数据列
        columnValues.forEach((colKey, index) => {
            // 调试输出当前处理的列
            if (process.env.NODE_ENV === "development") {
                console.log(`处理第 ${index + 1} 列: ${colKey}`);
            }

            cols.push(
                columnHelper.accessor(colKey, {
                    id: colKey,
                    header: () => (
                        <div className="w-full text-center px-2" title={colKey}>
                            {colKey.length > 8 ? `${colKey.substring(0, 8)}...` : colKey}
                        </div>
                    ),
                    cell: ({ getValue, row }) => {
                        const cell = getValue() as TableCellData;
                        if (!cell) return null;

                        const imageUrl = cell.hasValidImage ? cell.url : "";
                        const cellTitle = `${row.original.rowTitle}-${colKey}`;

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
                                                        <p title={`${yAxis}:${cell?.yValue || row.original.rowTitle.replace(/#\d+$/, "")}`}>
                                                            {(() => {
                                                                const text = `${yAxis}:${cell?.yValue || row.original.rowTitle.replace(/#\d+$/, "")}`;
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
                    size: 180, // 设置列宽
                    enableSorting: false, // 图片单元格不需要排序
                })
            );
        });

        // 调试打印最终列数
        if (process.env.NODE_ENV === "development") {
            console.log(`最终生成的表格列数: ${cols.length}, 包括: 1个行标题列 + ${cols.length - 1}个数据列`);
        }

        return cols;
    }, [columnValues, xAxis, yAxis, hasBatchTag, onViewImage, onViewMultipleImages]);

    // 初始化表格
    const table = useReactTable({
        data: tableData,
        columns,
        state: {
            sorting,
        },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        defaultColumn: {
            size: 180,
        },
    });

    // 设置虚拟化
    const { rows } = table.getRowModel();
    const rowVirtualizer = useVirtualizer({
        count: useVirtualization ? rows.length : 0,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: useCallback(() => 180, []), // 行高估计
        overscan: 5, // 预渲染额外的行数
    });

    // 切换虚拟化功能
    const toggleVirtualization = () => {
        setUseVirtualization(!useVirtualization);
    };

    return (
        <div className="flex flex-col h-full">
            {/* 仅保留虚拟滚动切换按钮 */}
            <div className="p-2 bg-default-50 border-b border-default-200 flex justify-end items-center flex-shrink-0">
                <Button
                    size="sm"
                    variant="flat"
                    color={useVirtualization ? "primary" : "default"}
                    startContent={<Icon icon="solar:speed-linear" width={16} />}
                    onPress={toggleVirtualization}
                >
                    虚拟滚动 {useVirtualization ? '开' : '关'}
                </Button>
            </div>

            <div
                ref={tableContainerRef}
                className="sticky-table-container flex-1 overflow-auto"
                style={{
                    transform: `scale(${tableScale / 100})`,
                    transformOrigin: "top left",
                    transition: "transform 0.2s ease",
                    width: "100%",
                    height: "100%",
                    overflowX: "auto"
                }}
            >
                <style jsx global>{`
                    .sticky-table-container {
                        overflow: auto;
                        max-height: 100%;
                        position: relative;
                        z-index: 1;
                        width: 100%;
                    }

                    .virtual-table-container {
                        overflow: auto;
                        width: 100%;
                    }

                    .matrix-table {
                        width: max-content;
                        border-spacing: 4px;
                        border-collapse: separate;
                        margin: 0;
                        box-shadow: 0 0 0 1px #e0e0e0;
                        table-layout: fixed;
                        display: table;
                    }

                    .matrix-table th {
                        position: sticky;
                        top: 0;
                        z-index: 10;
                        background-color: rgb(200, 200, 200);
                        box-shadow: 0 2px 4px rgba(0,0,0,0.15);
                        padding: 4px;
                        font-size: 0.75rem;
                        text-align: center;
                        border: 1px solid #e0e0e0;
                        height: auto;
                        display: table-cell;
                    }

                    .matrix-table th:first-child {
                        position: sticky;
                        left: 0;
                        top: 0;
                        z-index: 20;
                        box-shadow: 2px 2px 4px rgba(0,0,0,0.2);
                    }

                    .matrix-table td {
                        height: 180px;
                        width: 180px;
                        min-width: 180px;
                        max-width: 180px;
                        min-height: 180px;
                        padding: 0;
                        border: 1px solid #e0e0e0;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                        text-align: center;
                        vertical-align: middle;
                        border-radius: 0;
                        display: table-cell;
                    }

                    .matrix-table td:first-child {
                        position: sticky;
                        left: 0;
                        z-index: 5;
                        background-color: rgb(200, 200, 200);
                        width: 70px;
                        min-width: 70px;
                        max-width: 70px;
                        box-shadow: 2px 0 4px rgba(0,0,0,0.15);
                        padding: 2px 4px;
                        height: 180px;
                        display: table-cell;
                        font-size: 12px;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }

                    .matrix-table tr {
                        display: table-row;
                    }

                    .matrix-table th.sortable {
                        cursor: pointer;
                    }

                    .matrix-table th.sortable:hover {
                        background-color: rgb(190, 190, 190);
                    }

                    .matrix-table th.sorted-asc .sort-icon,
                    .matrix-table th.sorted-desc .sort-icon {
                        display: inline-block;
                        margin-left: 4px;
                    }
                `}</style>

                {useVirtualization ? (
                    // 虚拟滚动表格
                    <div className="virtual-table-container">
                        <table className="matrix-table">
                            <thead>
                                {table.getHeaderGroups().map(headerGroup => (
                                    <tr key={headerGroup.id}>
                                        {headerGroup.headers.map(header => (
                                            <th
                                                key={header.id}
                                                style={{
                                                    width: header.id === 'rowTitle' ? '70px' : '180px',
                                                    minWidth: header.id === 'rowTitle' ? '70px' : '180px',
                                                    maxWidth: header.id === 'rowTitle' ? '70px' : '180px',
                                                }}
                                                className={
                                                    header.column.getCanSort()
                                                        ? `sortable ${header.column.getIsSorted() === 'asc'
                                                            ? 'sorted-asc'
                                                            : header.column.getIsSorted() === 'desc'
                                                                ? 'sorted-desc'
                                                                : ''
                                                        }`
                                                        : ''
                                                }
                                                onClick={header.column.getToggleSortingHandler()}
                                            >
                                                <div className="flex items-center justify-center">
                                                    {flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext()
                                                    )}
                                                    {header.column.getCanSort() && (
                                                        <span className="sort-icon ml-1">
                                                            {header.column.getIsSorted() === 'asc' ? (
                                                                <Icon icon="solar:sort-by-up-bold" width={14} />
                                                            ) : header.column.getIsSorted() === 'desc' ? (
                                                                <Icon icon="solar:sort-by-down-bold" width={14} />
                                                            ) : (
                                                                <Icon icon="solar:sort-bold" width={14} className="opacity-50" />
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                ))}
                            </thead>
                        </table>

                        <div
                            className="virtual-table-rows"
                            style={{
                                height: `${rowVirtualizer.getTotalSize()}px`,
                                position: 'relative',
                                width: 'max-content',
                                minWidth: '100%',
                            }}
                        >
                            <table className="matrix-table" style={{ width: 'max-content' }}>
                                <tbody>
                                    {rowVirtualizer.getVirtualItems().map(virtualRow => {
                                        const row = rows[virtualRow.index];
                                        return (
                                            <tr
                                                key={row.id}
                                                style={{
                                                    height: `${virtualRow.size}px`,
                                                    transform: `translateY(${virtualRow.start}px)`,
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    width: '100%',
                                                }}
                                            >
                                                {row.getVisibleCells().map(cell => (
                                                    <td
                                                        key={cell.id}
                                                        className={cell.column.id === 'rowTitle' ? 'row-title' : 'data-cell'}
                                                    >
                                                        {flexRender(
                                                            cell.column.columnDef.cell,
                                                            cell.getContext()
                                                        )}
                                                    </td>
                                                ))}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    // 常规表格
                    <table className="matrix-table" style={{ width: 'max-content' }}>
                        <thead>
                            {table.getHeaderGroups().map(headerGroup => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map(header => (
                                        <th
                                            key={header.id}
                                            style={{
                                                width: header.id === 'rowTitle' ? '70px' : '180px',
                                                minWidth: header.id === 'rowTitle' ? '70px' : '180px',
                                                maxWidth: header.id === 'rowTitle' ? '70px' : '180px',
                                            }}
                                            className={
                                                header.column.getCanSort()
                                                    ? `sortable ${header.column.getIsSorted() === 'asc'
                                                        ? 'sorted-asc'
                                                        : header.column.getIsSorted() === 'desc'
                                                            ? 'sorted-desc'
                                                            : ''
                                                    }`
                                                    : ''
                                            }
                                            onClick={header.column.getToggleSortingHandler()}
                                        >
                                            <div className="flex items-center justify-center">
                                                {flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                                {header.column.getCanSort() && (
                                                    <span className="sort-icon ml-1">
                                                        {header.column.getIsSorted() === 'asc' ? (
                                                            <Icon icon="solar:sort-by-up-bold" width={14} />
                                                        ) : header.column.getIsSorted() === 'desc' ? (
                                                            <Icon icon="solar:sort-by-down-bold" width={14} />
                                                        ) : (
                                                            <Icon icon="solar:sort-bold" width={14} className="opacity-50" />
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody>
                            {table.getRowModel().rows.map(row => (
                                <tr key={row.id}>
                                    {row.getVisibleCells().map(cell => (
                                        <td
                                            key={cell.id}
                                            className={cell.column.id === 'rowTitle' ? 'row-title' : 'data-cell'}
                                        >
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
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

export default MatrixTableView;