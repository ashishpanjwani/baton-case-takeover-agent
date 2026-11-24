import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf.js, the native canvas and the Tesseract worker must stay server-side and un-bundled.
  serverExternalPackages: ["unpdf", "@napi-rs/canvas", "tesseract.js"],
  // Read at runtime by file path, so the deployment would otherwise leave them out:
  // the sample cases, and the OCR language data.
  outputFileTracingIncludes: {
    "/**": ["./seed/**/*", "./node_modules/@tesseract.js-data/eng/4.0.0_best_int/**/*"],
  },
};

export default nextConfig;
