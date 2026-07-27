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
          include: ["lib/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        resolve: { tsconfigPaths: true },
        test: {
          name: "dom",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          include: ["{components,hooks,app}/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
