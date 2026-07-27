import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Two projects: pure logic under lib/ runs in node (fast, no DOM), while
// components and hooks need jsdom. Keeping them split means the calc suite
// stays sub-second, which is the suite we run most often.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: "node",
          environment: "node",
          // Route handlers are server code and belong here, not in jsdom.
          include: ["lib/**/*.test.ts", "app/api/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        resolve: { tsconfigPaths: true },
        test: {
          name: "dom",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          include: ["{components,hooks}/**/*.test.{ts,tsx}", "app/**/*.test.tsx"],
        },
      },
    ],
  },
});
