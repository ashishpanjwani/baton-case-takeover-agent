import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf.js, the native canvas and the Tesseract worker must stay server-side and un-bundled.
  serverExternalPackages: ["unpdf", "@napi-rs/canvas", "tesseract.js"],
};

export default nextConfig;
