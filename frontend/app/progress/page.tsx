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

import ProgressTab from "@/components/progress/ProgressTab";
import { useAuth } from "@/app/api/v1/auth/client";

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

export default function ProgressPage() {
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
                  onClick={() => console.log("用户按钮被点击")}
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
              selectedKey="progress"
              size="sm"
              onSelectionChange={(key) => {
                router.push(
                  `/${key.toString() === "parameters" ? "parameters" : key}`,
                );
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
          <h2 className="text-xl font-medium">任务进度</h2>
        </CardHeader>

        <CardBody>
          <ProgressTab />
        </CardBody>
      </Card>
    </section>
  );
}
