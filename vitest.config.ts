import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/lib/**/*.ts", "src/server/services/**/*.ts"],
      exclude: [
        "src/__tests__/**",
        "**/*.d.ts",
        "src/lib/supabase/**/*",
        "src/lib/auth/session.ts",
        "src/lib/google/calendar-client.ts",
        "src/lib/google/tasks-client.ts",
        "src/lib/google/oauth.ts",
        "src/lib/telegram/bot.ts",
        "src/server/services/google-import.service.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/__tests__/__mocks__/server-only.ts"),
    },
  },
});
