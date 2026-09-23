import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // The app accepts visit photos up to 750 KB. This leaves enough room
      // for multipart form boundaries and the other visit fields.
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
