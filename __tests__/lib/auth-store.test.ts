// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  deleteAuth,
  deleteReminder,
  getAuthFilePath,
  getReminderFilePath,
  readAuth,
  readReminder,
  writeAuth,
  writeReminder,
  type StoredAuth,
  type StoredReminder,
} from "../../lib/auth/auth-store";

function fakeAuth(overrides: Partial<StoredAuth> = {}): StoredAuth {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: "access.jwt.token",
    refresh_token: "refresh.jwt.token",
    access_expires_at: now + 3600,
    refresh_expires_at: now + 86400,
    user: { id: "user-1", email: "alice@example.com" },
    ...overrides,
  };
}

function fakeReminder(overrides: Partial<StoredReminder> = {}): StoredReminder {
  return {
    next_audit_at: Math.floor(Date.now() / 1000) + 7 * 86400,
    user_email: "alice@example.com",
    set_at: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

describe("auth-store", () => {
  let dir: string;
  let originalAuthDir: string | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "fpa-auth-test-"));
    originalAuthDir = process.env.FAILPROOFAI_AUTH_DIR;
    process.env.FAILPROOFAI_AUTH_DIR = dir;
  });

  afterEach(() => {
    if (originalAuthDir === undefined) delete process.env.FAILPROOFAI_AUTH_DIR;
    else process.env.FAILPROOFAI_AUTH_DIR = originalAuthDir;
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  describe("auth", () => {
    it("returns null when no auth file exists", () => {
      expect(readAuth()).toBeNull();
    });

    it("round-trips a written auth file", () => {
      const auth = fakeAuth();
      writeAuth(auth);
      const out = readAuth();
      expect(out).not.toBeNull();
      expect(out?.user).toEqual(auth.user);
      expect(out?.access_token).toBe(auth.access_token);
    });

    it("rejects shape mismatches as null", () => {
      writeFileSync(getAuthFilePath(), JSON.stringify({ foo: 1 }), "utf-8");
      expect(readAuth()).toBeNull();
    });

    it("returns null on corrupt JSON", () => {
      writeFileSync(getAuthFilePath(), "{ not json", "utf-8");
      expect(readAuth()).toBeNull();
    });

    it("writes mode 0600 on the file", () => {
      writeAuth(fakeAuth());
      const mode = statSync(getAuthFilePath()).mode & 0o777;
      // World-readable bit must be cleared.
      expect(mode & 0o004).toBe(0);
      // Group-read also cleared.
      expect(mode & 0o040).toBe(0);
    });

    it("atomic write leaves no .tmp siblings behind on success", () => {
      writeAuth(fakeAuth());
      const leftover = readdirSync(dir).filter((f) => f.includes(".tmp"));
      expect(leftover).toEqual([]);
    });

    it("deleteAuth removes the file", () => {
      writeAuth(fakeAuth());
      expect(existsSync(getAuthFilePath())).toBe(true);
      deleteAuth();
      expect(existsSync(getAuthFilePath())).toBe(false);
    });

    it("backfills refresh_expires_at when omitted from the legacy file", () => {
      const now = Math.floor(Date.now() / 1000);
      writeFileSync(getAuthFilePath(), JSON.stringify({
        access_token: "a",
        refresh_token: "r",
        access_expires_at: now + 100,
        user: { id: "u", email: "e@e.com" },
      }), "utf-8");
      const out = readAuth();
      // Falls back to access_expires_at when the file pre-dated the field.
      expect(out?.refresh_expires_at).toBe(now + 100);
    });
  });

  describe("reminder", () => {
    it("returns null when no reminder file exists", () => {
      expect(readReminder()).toBeNull();
    });

    it("round-trips a written reminder", () => {
      const r = fakeReminder();
      writeReminder(r);
      const out = readReminder();
      expect(out).toEqual(r);
    });

    it("scopes by user_email — the consumer enforces this", () => {
      writeReminder(fakeReminder({ user_email: "bob@example.com" }));
      const out = readReminder();
      expect(out?.user_email).toBe("bob@example.com");
    });

    it("rejects shape mismatches as null", () => {
      writeFileSync(getReminderFilePath(), JSON.stringify({ next_audit_at: "string" }), "utf-8");
      expect(readReminder()).toBeNull();
    });

    it("deleteReminder removes the file", () => {
      writeReminder(fakeReminder());
      expect(existsSync(getReminderFilePath())).toBe(true);
      deleteReminder();
      expect(existsSync(getReminderFilePath())).toBe(false);
    });

    it("overwrites the existing reminder atomically", () => {
      writeReminder(fakeReminder({ next_audit_at: 1 }));
      writeReminder(fakeReminder({ next_audit_at: 2 }));
      expect(readReminder()?.next_audit_at).toBe(2);
    });

    it("writes mode 0600 on the reminder file", () => {
      writeReminder(fakeReminder());
      const mode = statSync(getReminderFilePath()).mode & 0o777;
      // World- and group-read bits must be cleared — next-audit.json stores
      // the user_email scoping key and gets the same hardening as auth.json.
      expect(mode & 0o004).toBe(0);
      expect(mode & 0o040).toBe(0);
    });

    it("atomic write leaves no .tmp siblings behind on success", () => {
      writeReminder(fakeReminder());
      const leftover = readdirSync(dir).filter((f) => f.includes(".tmp"));
      expect(leftover).toEqual([]);
    });
  });
});
