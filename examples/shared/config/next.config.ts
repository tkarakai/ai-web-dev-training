import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    // Enable experimental features if needed
    optimizePackageImports: ['lucide-react', 'react-markdown'],
  },
  // Allow images from common AI/ML service domains
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
