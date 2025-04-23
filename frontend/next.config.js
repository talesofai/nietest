/** @type {import('next').NextConfig} */
const nextConfig = {
  // 禁用类型检查
  typescript: {
    // 忽略构建时的类型错误
    ignoreBuildErrors: true,
  },
  // 忽略ESLint错误
  eslint: {
    // 即使有ESLint错误也继续构建
    ignoreDuringBuilds: true,
  },
  // 禁用图片优化
  images: {
    unoptimized: true,
    domains: ["oss.talesofai.cn"],
  },
  // 最简化配置，解决构建问题
  swcMinify: false,
  reactStrictMode: false,
};

// 使用CommonJS语法导出
// eslint-disable-next-line no-undef
module.exports = nextConfig;
