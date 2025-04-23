/**
 * Alert服务
 *
 * 提供一个简单的Alert服务，直接使用HeroUI的Alert样式
 */
class AlertService {
  /**
   * 获取类型对应的图标
   * @param type Alert类型
   * @returns SVG图标字符串
   */
  private getIconForType(type: "success" | "error" | "warning" | "info"): string {
    switch (type) {
      case "success":
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22 11.0857V12.0057C21.9988 14.1621 21.3005 16.2604 20.0093 17.9875C18.7182 19.7147 16.9033 20.9782 14.8354 21.5896C12.7674 22.201 10.5573 22.1276 8.53447 21.3803C6.51168 20.633 4.78465 19.2518 3.61096 17.4428C2.43727 15.6338 1.87979 13.4938 2.02168 11.342C2.16356 9.19029 2.99721 7.14205 4.39828 5.5028C5.79935 3.86354 7.69279 2.72111 9.79619 2.24587C11.8996 1.77063 14.1003 1.98806 16.07 2.86572" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M22 4L12 14.01L9 11.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      case "error":
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M15 9L9 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M9 9L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      case "warning":
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10.29 3.86L1.82 18C1.64537 18.3024 1.55296 18.6453 1.55199 18.9945C1.55101 19.3437 1.6415 19.6871 1.81442 19.9905C1.98734 20.2939 2.23672 20.5467 2.53773 20.7239C2.83875 20.901 3.1808 20.9962 3.53 21H20.47C20.8192 20.9962 21.1613 20.901 21.4623 20.7239C21.7633 20.5467 22.0127 20.2939 22.1856 19.9905C22.3585 19.6871 22.449 19.3437 22.448 18.9945C22.447 18.6453 22.3546 18.3024 22.18 18L13.71 3.86C13.5317 3.56611 13.2807 3.32312 12.9812 3.15448C12.6817 2.98585 12.3437 2.89725 12 2.89725C11.6563 2.89725 11.3183 2.98585 11.0188 3.15448C10.7193 3.32312 10.4683 3.56611 10.29 3.86Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12 9V13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12 17H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      case "info":
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12 16V12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12 8H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      default:
        return "";
    }
  }

  private showAlert(
    type: "success" | "error" | "warning" | "info",
    title: string,
    description: string
  ): void {
    // 在控制台记录消息
    // eslint-disable-next-line no-console
    // eslint-disable-next-line no-console
    // eslint-disable-next-line no-console
    console.log(`[${type.toUpperCase()}] ${title}: ${description}`);

    // 如果在浏览器环境中，可以使用HeroUI的Alert组件
    if (typeof window !== "undefined") {
      try {
        // 创建一个新的div元素来容统Alert
        const alertContainer = document.createElement("div");

        alertContainer.style.position = "fixed";
        alertContainer.style.bottom = "20px";
        alertContainer.style.right = "20px";
        alertContainer.style.zIndex = "9999";
        alertContainer.style.maxWidth = "400px";
        document.body.appendChild(alertContainer);

        // 创建一个新的div元素来容统Alert内容
        const alertElement = document.createElement("div");

        alertContainer.appendChild(alertElement);

        // 根据类型设置颜色
        let color: "default" | "primary" | "secondary" | "success" | "warning" | "danger" =
          "default";

        switch (type) {
          case "success":
            color = "success";
            break;
          case "error":
            color = "danger";
            break;
          case "warning":
            color = "warning";
            break;
          case "info":
            color = "primary";
            break;
        }

        // 创建 Alert 内容
        // 根据 HeroUI 的 Alert 组件样式
        alertElement.innerHTML = `
          <div class="max-w-md w-full bg-${color} text-white shadow-lg rounded-lg p-4 mb-4 relative overflow-hidden" role="alert">
            <div class="flex items-start gap-4">
              <div class="p-1 rounded-full bg-white/20">
                ${this.getIconForType(type)}
              </div>
              <div class="flex-1">
                <h4 class="font-medium text-base">${title}</h4>
                <p class="text-white/90 text-sm mt-1">${description}</p>
              </div>
              <button class="close-btn text-white/70 hover:text-white transition-colors" aria-label="Close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        `;

        // 添加关闭按钮事件
        const closeButton = alertElement.querySelector(".close-btn");

        if (closeButton) {
          closeButton.addEventListener("click", () => {
            alertContainer.remove();
          });
        }

        // 5秒后自动移除
        setTimeout(() => {
          alertContainer.remove();
        }, 5000);
      } catch (error) {
        // eslint-disable-next-line no-console
        // eslint-disable-next-line no-console
        // eslint-disable-next-line no-console
        console.error("无法显示Alert:", error);
      }
    }
  }

  /**
   * 显示成功Alert
   * @param title 标题
   * @param description 描述
   */
  public success(title: string, description: string): void {
    this.showAlert("success", title, description);
  }

  /**
   * 显示错误Alert
   * @param title 标题
   * @param description 描述
   */
  public error(title: string, description: string): void {
    this.showAlert("error", title, description);
  }

  /**
   * 显示警告Alert
   * @param title 标题
   * @param description 描述
   */
  public warning(title: string, description: string): void {
    this.showAlert("warning", title, description);
  }

  /**
   * 显示信息Alert
   * @param title 标题
   * @param description 描述
   */
  public info(title: string, description: string): void {
    this.showAlert("info", title, description);
  }

  /**
   * 显示通用Alert
   * @param options Alert选项
   */
  public show(options: { title: string; description: string; variant?: string }): void {
    const type = options.variant === "destructive" ? "error" : "success";

    this.showAlert(type, options.title, options.description);
  }
}

// 导出单例实例
export const alertService = new AlertService();
