import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf.js, the native canvas and the Tesseract worker must stay server-side and un-bundled.
  serverExternalPackages: ["unpdf", "@napi-rs/canvas", "tesseract.js"],
  // Loaded at runtime by file path, so the deployment would otherwise leave them out:
  // the sample cases, the OCR language data, and everything Tesseract's worker thread
  // loads (it is started from a file path, so its own imports are invisible to tracing):
  // the WebAssembly engine and the worker's dependencies.
  outputFileTracingIncludes: {
    "/**": [
      "./seed/**/*",
      "./node_modules/@tesseract.js-data/eng/4.0.0_best_int/**/*",
      "./node_modules/tesseract.js/**/*",
      "./node_modules/tesseract.js-core/**/*",
      "./node_modules/wasm-feature-detect/**/*",
      "./node_modules/is-url/**/*",
      "./node_modules/node-fetch/**/*",
      "./node_modules/whatwg-url/**/*",
      "./node_modules/tr46/**/*",
      "./node_modules/webidl-conversions/**/*",
      "./node_modules/regenerator-runtime/**/*",
      "./node_modules/bmp-js/**/*",
      "./node_modules/zlibjs/**/*",
    ],
  },
};

export default nextConfig;
