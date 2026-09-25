import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/admin/analytics/export": ["./src/assets/fonts/NotoSansArabic.ttf"],
  },
};

export default nextConfig;
