from typing import Dict, Any, List, Optional, Tuple
import logging
import random
import itertools

# 配置日志
logger = logging.getLogger(__name__)

class ImageGenerationService:
    """图片生成服务"""

    def __init__(self, x_token: str = ""):
        """
        初始化图片生成服务

        Args:
            x_token: API认证的token
        """
        self.x_token = x_token

    async def calculate_combinations(self, variables: Dict[str, Any]) -> List[Dict[str, Dict[str, str]]]:
        """
        计算所有变量组合

        Args:
            variables: 变量字典

        Returns:
            变量组合列表
        """
        # 过滤有效变量
        valid_variables = {}
        for var_name, var_data in variables.items():
            if var_name.startswith('v'):
                # 优先使用values_count字段
                values_count = var_data.get('values_count')
                if values_count is None and var_data.get('values'):
                    values_count = len(var_data.get('values'))

                # 如果有values_count并且大于0，则认为是有效变量
                if values_count and values_count > 0:
                    # 确保有values字段，如果没有或为空，创建一个空数组
                    if not var_data.get('values'):
                        var_data['values'] = []

                    # 如果values字段的长度与values_count不一致，补充或截取
                    if len(var_data.get('values')) != values_count:
                        logger.warning(f"变量 {var_name} 的values长度 ({len(var_data.get('values'))}) 与values_count ({values_count}) 不一致")

                        # 如果values为空，创建空占位符
                        if len(var_data.get('values')) == 0:
                            var_data['values'] = [{
                                "id": f"{var_name}_placeholder_{i}",
                                "value": f"placeholder_{i}",
                                "weight": 1.0
                            } for i in range(values_count)]

                    valid_variables[var_name] = var_data

        if not valid_variables:
            # 如果没有有效变量，返回一个空组合
            return [{}]

        # 准备变量值列表
        var_values = []
        var_names = []

        for var_name, var_data in sorted(valid_variables.items()):
            var_names.append(var_name)
            var_values.append(var_data.get('values', []))

        # 计算笛卡尔积
        combinations = []
        for values in itertools.product(*var_values):
            combination = {}
            for i, var_name in enumerate(var_names):
                value = values[i]

                # 处理不同类型的值
                if isinstance(value, dict):
                    # 如果是字典，确保有value字段
                    if 'value' in value:
                        # 创建一个新的字典，保留原始字典中的所有字段
                        value_dict = value.copy()

                        # 确保有tag_id字段，用于识别变量的标签
                        if 'tag_id' not in value_dict:
                            # 尝试从原始变量数据中获取tag_id
                            var_data = valid_variables.get(var_name, {})
                            value_dict['tag_id'] = var_data.get('tag_id', '')

                        # 确保有variable_id字段，如果没有但有id字段，则使用id字段
                        if 'variable_id' not in value_dict and 'id' in value_dict:
                            value_dict['variable_id'] = value_dict['id']

                        # 记录处理后的变量值
                        logger.debug(f"处理变量 {var_name} 的值: {value_dict}")

                        combination[var_name] = value_dict
                    else:
                        # 如果没有value字段，创建一个默认的字典
                        default_dict = {
                            "value": str(value),
                            "variable_id": f"{var_name}_{i}"
                        }

                        # 尝试从原始变量数据中获取tag_id
                        var_data = valid_variables.get(var_name, {})
                        default_dict['tag_id'] = var_data.get('tag_id', '')

                        logger.debug(f"创建默认变量 {var_name} 的值: {default_dict}")

                        combination[var_name] = default_dict
                else:
                    # 如果是字符串，创建字典
                    default_dict = {
                        "value": value,
                        "variable_id": f"{var_name}_{i}"
                    }

                    # 尝试从原始变量数据中获取tag_id
                    var_data = valid_variables.get(var_name, {})
                    default_dict['tag_id'] = var_data.get('tag_id', '')

                    logger.debug(f"创建字符串变量 {var_name} 的值: {default_dict}")

                    combination[var_name] = default_dict

            combinations.append(combination)

        # 记录组合数量
        logger.info(f"计算出 {len(combinations)} 个变量组合")

        return combinations

    async def extract_parameters(
        self,
        tags: List[Dict[str, Any]],
        combination: Dict[str, Dict[str, str]]
    ) -> Tuple[List[str], str, Optional[int], bool]:
        """
        从标签和组合中提取参数

        Args:
            tags: 标签列表
            combination: 变量组合

        Returns:
            提示词、比例、种子和是否使用润色
        """
        # 提取提示词
        prompts = []
        ratio = "1:1"  # 默认比例
        seed = random.randint(1, 2147483647)  # 默认随机种子
        use_polish = False  # 默认不使用润色

        # 从组合中提取变量值
        for var_key, var_data in combination.items():
            if var_key.startswith('v') and isinstance(var_data, dict):
                var_value = var_data.get("value", "")
                if var_value:
                    # 将变量值添加到提示词列表
                    prompts.append(var_value)

        # 处理标签
        for tag in tags:
            tag_type = tag.get("type")
            is_variable = tag.get("is_variable", False)

            if tag_type == "prompt":
                # 提示词标签
                if not is_variable:
                    # 固定提示词
                    tag_value = tag.get("value", "")
                    if tag_value:
                        prompts.append(tag_value)

            elif tag_type == "ratio":
                # 比例标签
                ratio = tag.get("value", "1:1")

            elif tag_type == "seed":
                # 种子标签
                try:
                    seed_value = tag.get("value")
                    if seed_value:
                        seed = int(seed_value)
                except (ValueError, TypeError):
                    pass

            elif tag_type == "polish":
                # 润色标签
                use_polish = tag.get("value", "false").lower() == "true"

            elif tag_type == "character":
                # 角色标签
                if not is_variable:
                    tag_value = tag.get("value", "")
                    if tag_value:
                        prompts.append(tag_value)

        # 记录提取的参数
        logger.info(f"提取参数: prompts={prompts}, ratio={ratio}, seed={seed}, use_polish={use_polish}")

        return prompts, ratio, seed, use_polish

    async def calculate_dimensions(self, ratio: str) -> Tuple[int, int]:
        """
        根据比例计算宽高

        Args:
            ratio: 比例字符串，如"1:1"、"4:3"等

        Returns:
            宽度和高度
        """
        # 默认尺寸
        default_width = 512
        default_height = 512

        try:
            # 解析比例
            parts = ratio.split(":")
            if len(parts) == 2:
                width_ratio = float(parts[0])
                height_ratio = float(parts[1])

                # 计算宽高
                if width_ratio > height_ratio:
                    width = default_width
                    height = int(default_width * height_ratio / width_ratio)
                else:
                    height = default_height
                    width = int(default_height * width_ratio / height_ratio)

                # 确保宽高是8的倍数
                width = (width // 8) * 8
                height = (height // 8) * 8

                return width, height
        except Exception as e:
            logger.error(f"计算尺寸时出错: {str(e)}")

        # 返回默认尺寸
        return default_width, default_height

    async def generate_image(
        self,
        prompts: List[str],
        width: int,
        height: int,
        seed: Optional[int] = None,
        advanced_translator: bool = False
    ) -> Dict[str, Any]:
        """
        生成图片

        Args:
            prompts: 提示词列表
            width: 宽度
            height: 高度
            seed: 随机种子
            advanced_translator: 是否使用高级翻译

        Returns:
            图片生成结果
        """
        # 这里是模拟实现，实际项目中需要调用真实的图片生成API
        logger.info(f"生成图片: prompts={prompts}, width={width}, height={height}, seed={seed}, advanced_translator={advanced_translator}")

        # 模拟生成结果
        result = {
            "success": True,
            "image_url": f"https://example.com/images/{seed}.jpg",
            "width": width,
            "height": height,
            "seed": seed,
            "prompts": prompts
        }

        return result

    async def extract_image_url(self, result: Dict[str, Any]) -> str:
        """
        从结果中提取图片URL

        Args:
            result: 图片生成结果

        Returns:
            图片URL
        """
        return result.get("image_url", "")
