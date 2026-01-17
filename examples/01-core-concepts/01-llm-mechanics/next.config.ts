import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  transpilePackages: ['@examples/shared'],
};

export default nextConfig;
