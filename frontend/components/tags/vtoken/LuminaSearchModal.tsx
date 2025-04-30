"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
  Card,
} from "@heroui/react";
import { CloseIcon } from "@heroui/shared-icons";

import { SearchSelectItem } from "@/types/search";

// 预设的Lumina选项
const PRESET_LUMINA_OPTIONS = [
  {
    uuid: "bf23667f-2e9e-4464-933c-5bc9e92a6126",
    type: "elementum",
    ref_uuid: "d99851b6-4eb3-45bf-a93f-fb95e4b1e699",
    name: "lumina4",
    short_name: "lumina4",
    status: "PUBLISHED",
    accessibility: "PUBLIC",
    platform: "nieta-app",
    config: {
      traits: null,
      avatar_img: "https://oss.talesofai.cn/picture_s/1xcgm2h7jblq_0.jpeg",
      header_img: "https://oss.talesofai.cn/picture_s/1xcgm2h7jblq_0.jpeg",
      latin_name: "",
      travel_preview: "提升亲密度，探索 TA 的更多人设词条吧",
      char_info: {
        tone: "not_available",
        toneeg: "not_available",
        background: "not_available"
      },
      is_cheerupable: true
    },
    heat_score: 50,
    header_img: "https://oss.talesofai.cn/picture_s/1xcgm2h7jblq_0.jpeg", // 添加外部header_img字段便于直接访问
  },
  {
    uuid: "1ee0811c-14ba-43a3-8029-d959bfbe33b5",
    type: "elementum",
    ref_uuid: "ddd71868-460f-4ada-bfc3-a1ea00960f3a",
    name: "lumina3",
    short_name: "lumina3",
    status: "PUBLISHED",
    accessibility: "PUBLIC",
    platform: "nieta-app",
    config: {
      traits: null,
      avatar_img: "https://oss.talesofai.cn/picture_s/1r7bkvs7h6yk_0.jpeg",
      header_img: "https://oss.talesofai.cn/picture_s/1r7bkvs7h6yk_0.jpeg",
      latin_name: "",
      travel_preview: "提升亲密度，探索 TA 的更多人设词条吧",
      char_info: {
        tone: "not_available",
        toneeg: "not_available",
        background: "not_available"
      },
      is_cheerupable: true
    },
    heat_score: 50,
    header_img: "https://oss.talesofai.cn/picture_s/1r7bkvs7h6yk_0.jpeg", // 添加外部header_img字段便于直接访问
  },
  {
    uuid: "dccc4881-c8da-4bb7-ae39-46ae3992e660",
    type: "elementum",
    ref_uuid: "abc8db55-0587-4e01-9b32-548a590fb864",
    name: "lumina2",
    short_name: "lumina2",
    status: "PUBLISHED",
    accessibility: "PUBLIC",
    platform: "nieta-app",
    config: {
      traits: null,
      avatar_img: "https://oss.talesofai.cn/picture_s/x2an269l5qrz_0.jpeg",
      header_img: "https://oss.talesofai.cn/picture_s/x2an269l5qrz_0.jpeg",
      latin_name: "",
      travel_preview: "提升亲密度，探索 TA 的更多人设词条吧",
      char_info: {
        tone: "not_available",
        toneeg: "not_available",
        background: "not_available"
      },
      is_cheerupable: true
    },
    heat_score: 50,
    header_img: "https://oss.talesofai.cn/picture_s/x2an269l5qrz_0.jpeg", // 添加外部header_img字段便于直接访问
  },
  {
    uuid: "b5edccfe-46a2-4a14-a8ff-f4d430343805",
    type: "elementum",
    ref_uuid: "13546e8c-923f-41fd-aca8-4875345e4ad9",
    name: "lumina1",
    short_name: "lumina1",
    status: "PUBLISHED",
    accessibility: "PUBLIC",
    platform: "nieta-app",
    config: {
      traits: null,
      avatar_img: "https://oss.talesofai.cn/picture_s/1y7f53e6itfn_0.jpeg",
      header_img: "https://oss.talesofai.cn/picture_s/1y7f53e6itfn_0.jpeg",
      latin_name: "",
      travel_preview: "提升亲密度，探索 TA 的更多人设词条吧",
      char_info: {
        tone: "not_available",
        toneeg: "not_available",
        background: "not_available"
      },
      is_cheerupable: true
    },
    heat_score: 50,
    header_img: "https://oss.talesofai.cn/picture_s/1y7f53e6itfn_0.jpeg", // 添加外部header_img字段便于直接访问
  },
];

/**
 * Lumina搜索模态框属性
 */
interface LuminaSearchModalProps {
  /** 模态框是否打开 */
  isOpen: boolean;
  /** 关闭模态框回调 */
  onClose: () => void;
  /** 选择项目回调 */
  onSelect: (item: SearchSelectItem) => void;
}

/**
 * Lumina搜索模态框组件
 * 显示预设的Lumina选项供用户选择
 */
const LuminaSearchModal: React.FC<LuminaSearchModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  // 处理选择项目
  const handleSelectItem = (item: SearchSelectItem) => {
    // 确保选择的项目包含所有必要的字段
    const fullItem = {
      ...item,
      // 确保必要字段存在
      uuid: item.uuid,
      name: item.name,
      type: "elementum",
      header_img: item.header_img,
      ref_uuid: (item as any).ref_uuid || "",
      short_name: (item as any).short_name || item.name,
      status: (item as any).status || "PUBLISHED",
      accessibility: (item as any).accessibility || "PUBLIC",
      platform: (item as any).platform || "nieta-app",
      config: (item as any).config || {
        traits: null,
        avatar_img: item.header_img,
        header_img: item.header_img,
        latin_name: "",
        travel_preview: "提升亲密度，探索 TA 的更多人设词条吧",
        char_info: {
          tone: "not_available",
          toneeg: "not_available",
          background: "not_available"
        },
        is_cheerupable: true
      },
      heat_score: (item as any).heat_score || 50,
    };

    // 输出调试信息
    console.log("Lumina选择项目:", fullItem);

    onSelect(fullItem);
    onClose();
  };

  // 图片加载错误处理
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="200" viewBox="0 0 150 200"%3E%3Crect width="150" height="200" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="14" fill="%23888888" text-anchor="middle" dominant-baseline="middle"%3ELumina%3C/text%3E%3C/svg%3E';
  };

  return (
    <Modal
      hideCloseButton
      classNames={{
        base: "max-w-5xl h-[600px]",
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
              <div className="text-xl font-medium">Lumina选择</div>
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
                <div className="text-sm text-gray-600 mb-2">
                  请选择一个Lumina预设选项：
                </div>

                {/* 预设选项 */}
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {PRESET_LUMINA_OPTIONS.map((item) => (
                    <Card
                      key={item.uuid}
                      isPressable
                      className="overflow-hidden"
                      onPress={() => handleSelectItem(item)}
                    >
                      {/* 图片容器 */}
                      <div
                        className="w-full relative overflow-hidden bg-gray-100"
                        style={{ paddingBottom: "133.33%" }}
                      >
                        <Image
                          alt={item.name}
                          className="w-full h-full object-cover absolute inset-0"
                          height={200}
                          src={item.header_img}
                          style={{ objectPosition: "center" }}
                          width={150}
                          onError={handleImageError}
                        />
                      </div>
                      <div className="p-2">
                        <div className="text-sm font-medium truncate">{item.name}</div>
                        <div className="text-xs text-gray-500 truncate">
                          UUID: {item.uuid.substring(0, 8)}...
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default LuminaSearchModal;
