import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force generateBuildId to bust CDN cache on every deploy
  generateBuildId: () => `build-${Date.now()}`,
  async redirects() {
    return [
      {
        source: "/:path*",
        destination: "https://dvlog.jp/:path*",
        permanent: true,
        has: [
          {
            type: "host",
            value: "vlog-advent-calendar.vercel.app",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
