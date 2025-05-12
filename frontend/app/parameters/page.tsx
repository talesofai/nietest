"use client";

import {
  Card,
  CardBody,
  CardHeader,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Tabs,
  Tab,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";

import DraggableTags from "@/components/tags/DroppableTagsV2";
import { useAuth } from "@/lib/auth";

// 使用Iconify图标
const SettingsIcon = (props: any) => (
  <Icon height="20" icon="solar:settings-outline" width="20" {...props} />
);
const ProgressIcon = (props: any) => (
  <Icon height="20" icon="solar:refresh-circle-outline" width="20" {...props} />
);
const HistoryIcon = (props: any) => (
  <Icon height="20" icon="solar:clock-circle-outline" width="20" {...props} />
);

export default function ParametersPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <section className="flex flex-col items-center justify-center gap-8 py-8 md:py-4">
      <Card className="w-full max-w-3xl relative">
        {/* 用户信息放在右上角 */}
        {user && (
          <div className="absolute top-2 right-2 z-50">
            <Dropdown>
              <DropdownTrigger>
                <button
                  className="px-3 py-1 rounded-md bg-default-100 border border-default-200 cursor-pointer hover:bg-default-200 transition-colors"
                  onClick={() => {
                    // eslint-disable-next-line no-console
                    // eslint-disable-next-line no-console
                    // eslint-disable-next-line no-console
                    console.log("用户按钮被点击");
                  }}
                >
                  <span className="text-sm font-medium">
                    {user.fullname || user.email.split("@")[0]}
                  </span>
                </button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="用户菜单"
                onAction={(key) => {
                  // eslint-disable-next-line no-console
                  // eslint-disable-next-line no-console
                  // eslint-disable-next-line no-console
                  console.log("菜单项被点击:", key);
                  if (key === "logout") {
                    logout();
                  }
                }}
              >
                <DropdownItem key="profile" className="gap-2">
                  <p className="font-semibold">已登录为</p>
                  <p className="font-semibold">{user.fullname || user.email}</p>
                </DropdownItem>
                <DropdownItem key="logout" color="danger">
                  退出登录
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        )}
        <CardHeader className="flex flex-col gap-1 items-center pt-10">
          <div className="absolute top-2 left-2">
            <Tabs
              aria-label="页面导航"
              selectedKey="parameters"
              size="sm"
              onSelectionChange={(key) => {
                router.push(`/${key.toString() === "parameters" ? "parameters" : key}`);
              }}
            >
              <Tab
                key="parameters"
                title={
                  <div className="flex items-center space-x-2">
                    <SettingsIcon />
                    <span>参数</span>
                  </div>
                }
              />
              <Tab
                key="progress"
                className="px-1 py-0.5"
                title={
                  <div className="flex items-center space-x-2">
                    <ProgressIcon />
                    <span>进度</span>
                  </div>
                }
              />
              <Tab
                key="history"
                title={
                  <div className="flex items-center space-x-2">
                    <HistoryIcon />
                    <span>历史</span>
                  </div>
                }
              />
            </Tabs>
          </div>
          {/* 间隔7px */}
          <div className="h-7" />
          <h2 className="text-xl font-medium">测试参数</h2>
          <p className="text-sm text-gray-500">拖动标签调整顺序，点击&quot;添加&quot;创建新标签</p>
          <p className="text-sm text-gray-500">标签顺序仅影响提示词先后顺序</p>
        </CardHeader>

        <CardBody>
          <DraggableTags />
        </CardBody>
      </Card>

      <div className="text-center text-sm text-gray-500 max-w-lg">
        <p>标签类型说明：</p>
        <ul className="mt-2 list-disc text-left pl-5">
          <li>
            <strong>提示词</strong>：可以添加多个提示词类型标签，用于描述你想要生成的图像内容
          </li>
          <li>
            <strong>比例</strong>：设置图像比例，提供多种预设选项，如1:1、3:4、16:9等
          </li>
          <li>
            <strong>批次</strong>：设置批处理大小，范围1-16，决定一次生成多少张图片
          </li>
          <li>
            <strong>种子</strong>：设置生成种子，输入0或正整数，相同的种子值在相同条件下会生成相似的图像
          </li>
          <li>
            <strong>润色</strong>：启用或禁用润色功能，可以提升图像的质量和细节
          </li>
          <li>
            <strong>角色</strong>：设置图像中的角色，可以从预设角色库中选择
          </li>
          <li>
            <strong>元素</strong>：添加特定的视觉元素，如场景、物品等
          </li>
          <li>
            <strong>Lumina</strong>：选择Lumina模型进行图像生成，选择lumina1时，有以下附加选项
          </li>
          <li>
            <strong>Lumina模型</strong>：选择特定的Lumina模型文件
          </li>
          <li>
            <strong>Lumina步数</strong>：设置Lumina模型的推理步数，影响生成图像的质量和细节
          </li>
          <li>
            <strong>LuminaCFG</strong>：设置Lumina模型的CFG值，影响生成图像对提示词的遵循程度
          </li>
        </ul>
        <p className="mt-4">将标签设置为&quot;变量&quot;后，可以在下方为其添加多个变量值</p>
      </div>
    </section>
  );
}
