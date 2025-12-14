import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    watch: false,
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.{js,ts}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/index.ts",
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/test-nodes.ts", // Test utilities
        "src/scripting/generated/**/*", // Generated files
      ],
    },
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
});
