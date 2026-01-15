import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'wine-note.jp',
      },
      {
        protocol: 'https',
        hostname: 'elna-fluffiest-antonio.ngrok-free.dev',
      },
    ],
  },
};

export default nextConfig;
