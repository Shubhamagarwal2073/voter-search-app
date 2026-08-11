import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['sqlite3'],
  experimental: {
    outputFileTracingIncludes: {
      '/api/**/*': ['./data/**/*'],
    },
  },
};

export default nextConfig;
