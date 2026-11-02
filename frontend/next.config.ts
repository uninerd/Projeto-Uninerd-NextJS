import type { NextConfig } from 'next';
import path from 'node:path';
const config: NextConfig = {
  output: 'standalone', poweredByHeader: false,
  outputFileTracingRoot: path.resolve(__dirname),
  turbopack: { root: path.resolve(__dirname) },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${process.env.BACKEND_URL ?? 'http://127.0.0.1:3001'}/api/:path*` }];
  },
};
export default config;
