import React from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from "@heroui/react";
import { Input } from "@heroui/input";

interface GlobalSettings {
  maxThreads: number;
  xToken: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  globalSettings: GlobalSettings;
  setGlobalSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
}

/**
 * 全局设置模态框组件
 * 管理最大线程数和X-Token等全局设置
 */
const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  globalSettings,
  setGlobalSettings,
}) => {
  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <ModalContent>
        {(onModalClose: () => void) => (
          <>
            <ModalHeader className="flex flex-col gap-1">全局设置</ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <div>
                  <label htmlFor="max-threads" className="block text-sm font-medium mb-1">
                    最大线程数
                  </label>
                  <Input
                    id="max-threads"
                    className="w-full"
                    max={32}
                    min={1}
                    type="number"
                    value={globalSettings.maxThreads.toString()}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const value = parseInt(e.target.value);

                      if (!isNaN(value) && value >= 1 && value <= 32) {
                        setGlobalSettings((prev) => ({
                          ...prev,
                          maxThreads: value,
                        }));
                      }
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="x-token" className="block text-sm font-medium mb-1">
                    X-Token
                  </label>
                  <Input
                    id="x-token"
                    className="w-full"
                    type="password"
                    value={globalSettings.xToken}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setGlobalSettings((prev) => ({
                        ...prev,
                        xToken: e.target.value,
                      }));
                    }}
                  />
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onModalClose}>
                取消
              </Button>
              <Button color="primary" onPress={onModalClose}>
                确定
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default SettingsModal;
