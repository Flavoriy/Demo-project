import { describe, expect, it } from "vitest";
import { truncateString } from "@/lib/utils/string";

describe("truncateString", () => {
  it("should return empty string if input is empty", () => {
    expect(truncateString("", 10)).toBe("");
  });

  it("should return the original string if it is shorter than the limit", () => {
    expect(truncateString("hello", 10)).toBe("hello");
  });

  it("should return the original string if it equals the limit", () => {
    expect(truncateString("hello", 5)).toBe("hello");
  });

  it("should truncate and append three dots if string exceeds limit", () => {
    expect(truncateString("hello world", 5)).toBe("hello...");
  });

  it("should truncate and append custom suffix if specified", () => {
    expect(truncateString("hello world", 5, " (read more)")).toBe("hello (read more)");
  });
});
