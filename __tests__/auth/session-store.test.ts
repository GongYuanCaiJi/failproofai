// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("auth/session-store", () => {
  const fakeHome = mkdtempSync(join(tmpdir(), "failproofai-auth-test-"));
  const sessionFile = join(fakeHome, ".failproofai", "session.json");

  beforeEach(() => {
    vi.resetModules();
    vi.doMock("node:os", async (orig) => {
      const real = await (orig as () => Promise<typeof import("node:os")>)();
      return { ...real, homedir: () => fakeHome };
    });
  });

  afterEach(() => {
    rmSync(fakeHome, { recursive: true, force: true });
    vi.doUnmock("node:os");
  });

  function makeSession() {
    return {
      user: { id: "u-1", email: "jane@acme.com" },
      access_token: "access-abc",
      access_expires_at: 1_700_000_000_000,
      refresh_token: "refresh-xyz",
      refresh_expires_at: 1_700_999_999_999,
      api_base_url: "https://api.example.com",
    };
  }

  it("writes and reads back the same session", async () => {
    const mod = await import("../../src/auth/session-store");
    const session = makeSession();
    mod.writeSession(session);
    expect(mod.readSession()).toEqual(session);
  });

  it("writes the session file with mode 0600", async () => {
    if (process.platform === "win32") return;
    const mod = await import("../../src/auth/session-store");
    mod.writeSession(makeSession());
    const mode = statSync(sessionFile).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("returns null when no session file exists", async () => {
    const mod = await import("../../src/auth/session-store");
    expect(mod.readSession()).toBeNull();
  });

  it("returns null for a session file with missing required fields", async () => {
    const { writeFileSync, mkdirSync } = await import("node:fs");
    mkdirSync(join(fakeHome, ".failproofai"), { recursive: true });
    writeFileSync(sessionFile, JSON.stringify({ user: { id: "u" } }), "utf-8");
    const mod = await import("../../src/auth/session-store");
    expect(mod.readSession()).toBeNull();
  });

  it("clearSession removes the file and is idempotent", async () => {
    const mod = await import("../../src/auth/session-store");
    mod.writeSession(makeSession());
    mod.clearSession();
    expect(mod.readSession()).toBeNull();
    expect(() => mod.clearSession()).not.toThrow();
  });
});
