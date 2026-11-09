import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  // Keep native PDF/canvas packages out of the Next bundler (needed on Vercel).
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  turbopack: {
    resolveAlias: {
      canvas: "./node_modules/canvas/build/Release/canvas.node",
      encoding: "./node_modules/encoding/lib/iconv-loader.js",
    },
  },
};

export default nextConfig;
