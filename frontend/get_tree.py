import os
import pathspec
from pathlib import Path

def load_gitignore_spec():
    """加载 .gitignore 文件并创建 pathspec 规则"""
    if not Path('.gitignore').exists():
        print("警告: 未找到 .gitignore 文件，将显示所有文件")
        return None

    with open('.gitignore', 'r', encoding='utf-8') as f:
        lines = f.read().splitlines()

    return pathspec.PathSpec.from_lines('gitwildmatch', lines)

def print_tree(directory='.', prefix='', spec=None):
    """递归打印目录树，尊重 .gitignore 规则，并始终忽略 .git 目录"""
    directory_path = Path(directory)

    # 获取目录中的所有条目
    entries = list(directory_path.iterdir())
    entries.sort(key=lambda x: (not x.is_dir(), x.name.lower()))  # 目录在前，文件在后

    # 遍历每个条目
    for i, entry in enumerate(entries):
        # 始终忽略 .git 目录
        if entry.name == '.git':
            continue

        # 检查是否应该忽略（根据 .gitignore）
        rel_path = os.path.relpath(entry, '.')
        if spec and spec.match_file(rel_path):
            continue

        # 检查是否为最后一个条目
        is_last = i == len(entries) - 1

        # 确定当前行的前缀
        current_prefix = '└── ' if is_last else '├── '

        # 打印当前条目
        print(f"{prefix}{current_prefix}{entry.name}")

        # 如果是目录，递归处理
        if entry.is_dir():
            # 确定子目录的前缀
            next_prefix = prefix + ('    ' if is_last else '│   ')
            print_tree(entry, next_prefix, spec)

def main():
    """主函数"""
    spec = load_gitignore_spec()
    print(os.path.basename(os.getcwd()) + '/')
    print_tree('.', '', spec)

if __name__ == '__main__':
    main()
