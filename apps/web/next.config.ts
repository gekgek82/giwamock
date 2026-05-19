import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Set correct monorepo root for Turbopack
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Standalone output for production deployment (PM2 + server.js)
  output: "standalone",

  // Transpile shared monorepo package
  transpilePackages: ["@giwater/shared"],

  // Image configuration for external hosts
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "giwater-bucket.s3.ap-northeast-2.amazonaws.com",
        pathname: "/**",
      },
    ],
  },

  // Turbopack configuration (Next.js 16+)
  turbopack: {
    root: path.join(__dirname, "../../"),
  },

  // Webpack configuration (fallback for --webpack flag)
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;
