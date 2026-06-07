// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Mock the api-server-client so refresh requests are observable + controllable.
const refreshAccessTokenMock = vi.fn();
vi.mock("@/lib/auth/api-server-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/api-server-client")>(
    "@/lib/auth/api-server-client",
  );
  return {
    ...actual,
    refreshAccessToken: (...args: unknown[]) => refreshAccessTokenMock(...args),
    fetchMe: vi.fn(async (token: string) => ({
      id: "u",
      email: "a@b.co",
      status: "active",
      created_at: "0",
    })),
  };
});

import {
  getValidAccessToken,
  writeAuth,
  type StoredAuth,
} from "../../lib/auth/auth-store";

function fakeAuth(overrides: Partial<StoredAuth> = {}): StoredAuth {
  // Default to "needs refresh" — access expires now.
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: "old.access",
    refresh_token: "rt-1",
    access_expires_at: now,
    refresh_expires_at: now + 86400,
    user: { id: "u", email: "a@b.co" },
    ...overrides,
  };
}

describe("getValidAccessToken — in-flight refresh dedup", () => {
  let dir: string;
  let originalAuthDir: string | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "fpa-refresh-test-"));
    originalAuthDir = process.env.FAILPROOFAI_AUTH_DIR;
    process.env.FAILPROOFAI_AUTH_DIR = dir;
    refreshAccessTokenMock.mockReset();
  });

  afterEach(() => {
    if (originalAuthDir === undefined) delete process.env.FAILPROOFAI_AUTH_DIR;
    else process.env.FAILPROOFAI_AUTH_DIR = originalAuthDir;
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("two concurrent callers share one refreshAccessToken call", async () => {
    writeAuth(fakeAuth());
    // Slow refresh so both callers definitely overlap.
    let resolveRefresh!: (v: unknown) => void;
    refreshAccessTokenMock.mockReturnValueOnce(
      new Promise((res) => { resolveRefresh = res; }),
    );

    const p1 = getValidAccessToken();
    const p2 = getValidAccessToken();
    // Give both calls a tick to enter the refresh.
    await new Promise((res) => setTimeout(res, 0));
    resolveRefresh({
      token_type: "Bearer",
      access_token: "new.access",
      access_expires_in: 3600,
      refresh_token: "rt-2",
      refresh_expires_in: 86400,
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(refreshAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(r1?.access_token).toBe("new.access");
    expect(r2?.access_token).toBe("new.access");
  });

  it("clears the in-flight slot when refresh fails so the next call retries", async () => {
    writeAuth(fakeAuth());
    refreshAccessTokenMock.mockRejectedValueOnce(new Error("upstream down"));
    refreshAccessTokenMock.mockResolvedValueOnce({
      token_type: "Bearer",
      access_token: "new.access",
      access_expires_in: 3600,
      refresh_token: "rt-2",
      refresh_expires_in: 86400,
    });

    const first = await getValidAccessToken();
    expect(first).toBeNull();

    // Re-prime the auth file (the failed call shouldn't have deleted it,
    // since deletion only happens on a 401 from the AuthApiError branch).
    writeAuth(fakeAuth());
    const second = await getValidAccessToken();
    expect(second?.access_token).toBe("new.access");
    expect(refreshAccessTokenMock).toHaveBeenCalledTimes(2);
  });

  it("a later caller after the in-flight refresh completes starts a fresh refresh", async () => {
    writeAuth(fakeAuth());
    refreshAccessTokenMock.mockResolvedValue({
      token_type: "Bearer",
      access_token: "new.access",
      access_expires_in: 3600,
      refresh_token: "rt-2",
      refresh_expires_in: 86400,
    });

    await getValidAccessToken();
    // Re-flip the auth to needs-refresh so the next call hits the refresh path
    // instead of short-circuiting on REFRESH_LEEWAY_SECS.
    writeAuth(fakeAuth({ refresh_token: "rt-2" }));
    await getValidAccessToken();
    // First call + second call = 2; dedup only applies WHILE the first is in flight.
    expect(refreshAccessTokenMock).toHaveBeenCalledTimes(2);
  });
});
