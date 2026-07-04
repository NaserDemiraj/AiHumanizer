import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Packages that must load from real node_modules at runtime instead of
  // being bundled: tesseract.js spawns a Node worker by filesystem path,
  // and pdf-parse/@napi-rs/canvas load native binaries.
  serverExternalPackages: ["tesseract.js", "pdf-parse", "@napi-rs/canvas"],
};

export default nextConfig;
