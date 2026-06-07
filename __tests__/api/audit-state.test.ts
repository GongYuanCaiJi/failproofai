// @vitest-environment node
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { tryAcquireRun, releaseRun, getRunState } from "../../app/api/audit/_state";

const LOCK_MAX_AGE_MS = 5 * 60_000;

describe("audit run-lock state", () => {
  beforeEach(() => {
    // Belt-and-suspenders: tests share module state, so always reset first.
    releaseRun();
    vi.useRealTimers();
  });

  afterEach(() => {
    releaseRun();
    vi.useRealTimers();
  });

  it("the first tryAcquireRun wins and the second fails", () => {
    expect(tryAcquireRun()).toBe(true);
    expect(tryAcquireRun()).toBe(false);
    expect(getRunState().running).toBe(true);
  });

  it("releaseRun lets the next caller acquire", () => {
    expect(tryAcquireRun()).toBe(true);
    releaseRun();
    expect(tryAcquireRun()).toBe(true);
  });

  it("a lock older than LOCK_MAX_AGE_MS auto-expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-06T00:00:00Z"));
    expect(tryAcquireRun()).toBe(true);
    // Jump past the expiry window.
    vi.setSystemTime(new Date(Date.now() + LOCK_MAX_AGE_MS + 1000));
    expect(getRunState().running).toBe(false);
    expect(tryAcquireRun()).toBe(true);
  });

  it("a lock younger than LOCK_MAX_AGE_MS stays held", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-06T00:00:00Z"));
    expect(tryAcquireRun()).toBe(true);
    vi.setSystemTime(new Date(Date.now() + LOCK_MAX_AGE_MS - 1000));
    expect(getRunState().running).toBe(true);
    expect(tryAcquireRun()).toBe(false);
  });

  it("releaseRun on an unheld lock is a no-op", () => {
    releaseRun();
    releaseRun();
    expect(getRunState().running).toBe(false);
  });
});
