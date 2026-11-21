import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "postgres", "sharp", "mammoth", "unpdf", "tesseract.js", "tesseract.js-core"],
  // local OCR: the worker script, the wasm core and the English model are loaded at runtime, so ship them with the functions
  outputFileTracingIncludes: {
    "/**": ["./node_modules/tesseract.js/**/*", "./node_modules/tesseract.js-core/**/*", "./node_modules/@tesseract.js-data/eng/4.0.0_best_int/**/*", "./node_modules/wasm-feature-detect/**/*", "./node_modules/regenerator-runtime/**/*", "./node_modules/is-url/**/*", "./node_modules/bmp-js/**/*", "./node_modules/zlibjs/**/*", "./node_modules/node-fetch/**/*", "./node_modules/whatwg-url/**/*", "./node_modules/tr46/**/*", "./node_modules/webidl-conversions/**/*", "./node_modules/idb-keyval/**/*", "./node_modules/opencollective-postinstall/**/*"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
