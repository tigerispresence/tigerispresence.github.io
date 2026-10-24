import { beforeEach, describe, expect, it } from "vitest";
import { ASK_LIMIT, ASK_WINDOW_MS, checkRateLimit, resetRateLimit } from "./rateLimit";

describe("checkRateLimit", () => {
  beforeEach(() => resetRateLimit());

  it("allows the limit, then blocks with a retry delay", () => {
    for (let i = 0; i < ASK_LIMIT; i++) expect(checkRateLimit("1.2.3.4", 1000 + i)).toBe(0);
    expect(checkRateLimit("1.2.3.4", 2000)).toBeGreaterThan(0);
  });

  it("frees up once the oldest request leaves the window", () => {
    for (let i = 0; i < ASK_LIMIT; i++) checkRateLimit("1.2.3.4", 1000);
    expect(checkRateLimit("1.2.3.4", 1000 + ASK_WINDOW_MS)).toBe(0);
  });

  it("counts each visitor separately", () => {
    for (let i = 0; i < ASK_LIMIT; i++) checkRateLimit("a", 1000);
    expect(checkRateLimit("b", 1000)).toBe(0);
  });
});
