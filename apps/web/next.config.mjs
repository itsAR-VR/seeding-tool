import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
  // outputFileTracingRoot: add back when shared packages exist at monorepo root
};

export default nextConfig;
