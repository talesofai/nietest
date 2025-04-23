/** @type {import('next').NextConfig} */
const nextConfig = {
  // 禁用类型检查
  typescript: {
    // 忽略构建时的类型错误
    ignoreBuildErrors: true,
  },
  async rewrites() {
    const apiBaseUrl =
      process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
    // eslint-disable-next-line no-console
    console.log(`配置API代理: ${apiBaseUrl}`);

    return [
      // 将所有API请求代理到后端服务器，保持路径一致
      {
        source: "/api/:path*",
        destination: `${apiBaseUrl}/api/:path*`,
      },
    ];
  },
  // CORS配置
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,POST,PUT,DELETE,OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Token, X-Platform",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
