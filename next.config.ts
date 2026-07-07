import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force generateBuildId to bust CDN cache on every deploy
  generateBuildId: () => `build-${Date.now()}`,
};

export default nextConfig;
