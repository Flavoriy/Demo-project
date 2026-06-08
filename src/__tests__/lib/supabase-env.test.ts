import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  assertSupabaseConfig,
  getSupabaseConfig,
  getSupabasePublishableKey,
  getSupabaseUrl,
} from "@/lib/supabase/env";

const supabaseEnvKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

const originalEnv = Object.fromEntries(supabaseEnvKeys.map((key) => [key, process.env[key]]));

function clearSupabaseEnv() {
  for (const key of supabaseEnvKeys) {
    delete process.env[key];
  }
}

beforeEach(() => {
  clearSupabaseEnv();
});

afterEach(() => {
  clearSupabaseEnv();

  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("Supabase env helpers", () => {
  it("reads the configured Supabase URL", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

    expect(getSupabaseUrl()).toBe("https://example.supabase.co");
  });

  it("prefers the publishable key over the legacy anon key", () => {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    expect(getSupabasePublishableKey()).toBe("publishable-key");
  });

  it("falls back to the legacy anon key", () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    expect(getSupabasePublishableKey()).toBe("anon-key");
  });

  it("returns the combined config", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";

    expect(getSupabaseConfig()).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "publishable-key",
    });
  });

  it("throws when required Supabase config is missing", () => {
    clearSupabaseEnv();

    expect(() => assertSupabaseConfig()).toThrow("Supabase is not configured.");
  });

  it("returns config when URL and a publishable key are present", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";

    expect(assertSupabaseConfig()).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "publishable-key",
    });
  });
});
