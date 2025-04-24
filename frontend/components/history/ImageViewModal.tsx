import React from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Image,
} from "@heroui/react";
import { Icon } from "@iconify/react";

// 获取调整尺寸后的图片URL
const getResizedImageUrl = (url: string, size: number): string => {
  if (!url) return url;

  // 检查URL是否已经包含OSS处理参数
  if (url.includes("x-oss-process=")) {
    return url; // 已经有处理参数，不再添加
  }

  // 添加OSS处理参数
  const separator = url.includes("?") ? "&" : "?";

  return `${url}${separator}x-oss-process=image/resize,l_${size}/quality,q_80/format,webp`;
};

// 根据图片数量确定网格列数
const getGridColumns = (imageCount: number): string => {
  if (imageCount <= 1) return "grid-cols-1";
  if (imageCount <= 4) return "grid-cols-2";
  if (imageCount <= 9) return "grid-cols-3";
  if (imageCount <= 16) return "grid-cols-4";

  return "grid-cols-5"; // 如果超过16张，使用5列
};

// 根据批次图片数量确定图片尺寸
const getImageSizeByBatchCount = (imageCount: number): number => {
  if (imageCount <= 1) return 180; // 调整为更合适的尺寸
  if (imageCount <= 4) return 90; // 调整为更合适的尺寸
  if (imageCount <= 9) return 60; // 调整为更合适的尺寸
  if (imageCount <= 16) return 45; // 调整为更合适的尺寸

  return 20; // 如果超过16张，使用更小的尺寸
};

interface ImageViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageUrls: string[];
  title: string;
  isGridView: boolean;
  setIsGridView: (value: boolean) => void;
  getCoordinateInfo: (imageUrl: string) => string;
}

export const ImageViewModal: React.FC<ImageViewModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  imageUrls,
  title,
  isGridView,
  setIsGridView,
  getCoordinateInfo,
}) => {
  return (
    <Modal isOpen={isOpen} size="5xl" onClose={onClose}>
      <ModalContent>
        {(onCloseModal) => (
          <>
            <ModalHeader className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">{title || "图片查看"}</h3>
                {!isGridView && imageUrl && (
                  <p className="text-xs text-default-500 mt-1">
                    {getCoordinateInfo(imageUrl)}
                  </p>
                )}
                {isGridView && (
                  <p className="text-xs text-default-500 mt-1">
                    批量图片: {imageUrls.length} 张
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {imageUrls.length > 1 && (
                  <Button
                    color="primary"
                    size="sm"
                    startContent={
                      <Icon
                        icon={
                          isGridView
                            ? "solar:square-single-linear"
                            : "solar:square-multiple-linear"
                        }
                        width={16}
                      />
                    }
                    variant="bordered"
                    onPress={() => setIsGridView(!isGridView)}
                  >
                    {isGridView ? "单张查看" : "网格查看"}
                  </Button>
                )}
              </div>
            </ModalHeader>
            <ModalBody className="bg-default-900 p-4 overflow-auto" style={{ minHeight: "60vh" }}>
              {!isGridView && imageUrl && (
                <div className="flex items-center justify-center">
                  <Image
                    alt={title}
                    className="max-w-full max-h-full object-contain"
                    height="auto"
                    src={imageUrl} // 使用原始URL，不添加缩放参数
                    style={{ maxHeight: "70vh", objectFit: "contain" }}
                    width="auto"
                    onError={() => {
                      // eslint-disable-next-line no-console
                      console.log("大图加载失败:", imageUrl);
                    }}
                  />
                </div>
              )}

              {isGridView && imageUrls.length > 0 && (
                <div
                  className={`grid gap-4 ${getGridColumns(imageUrls.length)}`}
                  style={{ gridAutoRows: "minmax(300px, auto)" }}
                >
                  {imageUrls.map((url, index) => (
                    <div
                      key={index}
                      className="relative overflow-hidden border border-default-200 cursor-pointer flex items-center justify-center bg-default-50"
                      role="button"
                      style={{ minHeight: "300px" }}
                      tabIndex={0}
                      onClick={() => {
                        setIsGridView(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setIsGridView(false);
                        }
                      }}
                    >
                      <div className="w-full h-full flex items-center justify-center">
                        <Image
                          alt={`${title} - 批次 ${index + 1}`}
                          className="object-contain max-w-full max-h-full"
                          height="auto"
                          src={getResizedImageUrl(
                            url,
                            getImageSizeByBatchCount(imageUrls.length)
                          )}
                          style={{ objectFit: "contain" }}
                          width="auto"
                          onError={() => {
                            // eslint-disable-next-line no-console
                            console.log("网格图片加载失败:", url);
                          }}
                        />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 text-center">
                        批次 {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button
                color="primary"
                startContent={<Icon icon="solar:close-circle-linear" width={18} />}
                variant="bordered"
                onPress={onCloseModal}
              >
                关闭
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
