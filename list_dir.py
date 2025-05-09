import os

def list_directory(path):
    """列出指定目录下的所有文件和子目录"""
    try:
        print(f"列出目录: {path}")
        if os.path.exists(path):
            items = os.listdir(path)
            for item in items:
                item_path = os.path.join(path, item)
                if os.path.isdir(item_path):
                    print(f"[目录] {item}")
                else:
                    print(f"[文件] {item}")
        else:
            print(f"错误: 目录 {path} 不存在")
    except Exception as e:
        print(f"发生错误: {e}")

if __name__ == "__main__":
    # 列出前端public目录
    base_dir = os.path.dirname(os.path.abspath(__file__))
    public_dir = os.path.join(base_dir, "frontend", "public")
    list_directory(public_dir)
