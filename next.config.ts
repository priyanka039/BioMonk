import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      canvas: "./node_modules/canvas/build/Release/canvas.node",
      encoding: "./node_modules/encoding/lib/iconv-loader.js",
    },
  },
};

export default nextConfig;
