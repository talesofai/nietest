"""
检查Dramatiq的CLI模块
"""

import dramatiq.cli
import inspect
import sys

# 打印dramatiq.cli模块中的所有函数和类
print("dramatiq.cli模块中的所有函数和类:")
for name, obj in inspect.getmembers(dramatiq.cli):
    if inspect.isfunction(obj) or inspect.isclass(obj):
        print(f"- {name}: {obj}")

# 打印dramatiq.cli模块的源代码
print("\ndramatiq.cli模块的源代码:")
print(inspect.getsource(dramatiq.cli))
