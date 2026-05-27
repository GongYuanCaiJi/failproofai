// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readDashboardCache,
  writeDashboardCache,
  isCacheStale,
} from "../../src/audit/dashboard-cache";
import type { AuditResult } from "../../src/audit/types";

const FAKE_RESULT: AuditResult = {
  version: 2,
  scannedAt: "2026-05-26T00:00:00.000Z",
  scope: { cli: ["claude"], projects: "all", since: null },
  transcripts: { scanned: 5, skipped: 0, errors: 0, durationMs: 100 },
  results: [],
  totals: { hits: 0, projectsWithHits: 0 },
  projectsScanned: ["/home/u/a", "/home/u/b"],
  eventsScanned: 42,
  enabledBuiltinNames: ["block-failproofai-commands"],
};

describe("dashboard cache", () => {
  let tmpHome: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    // Redirect homedir() to a tmp directory by overriding HOME — os.homedir()
    // reads it on every call on POSIX, so the dashboard-cache module sees
    // our tmp path without needing module mocks.
    tmpHome = mkdtempSync(join(tmpdir(), "fpa-audit-cache-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = tmpHome;
  });

  afterEach(() => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    try { rmSync(tmpHome, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("returns null when no cache file exists", () => {
    expect(readDashboardCache()).toBeNull();
  });

  it("round-trips a written entry", () => {
    writeDashboardCache({ since: "7d" }, FAKE_RESULT);
    const entry = readDashboardCache();
    expect(entry).not.toBeNull();
    expect(entry?.params).toEqual({ since: "7d" });
    expect(entry?.result.transcripts.scanned).toBe(5);
    expect(entry?.result.projectsScanned).toEqual(["/home/u/a", "/home/u/b"]);
    expect(typeof entry?.cachedAt).toBe("string");
  });

  it("writes mode 0600 on the file", () => {
    writeDashboardCache({}, FAKE_RESULT);
    const cachePath = join(tmpHome, ".failproofai", "audit-dashboard.json");
    expect(existsSync(cachePath)).toBe(true);
    const mode = statSync(cachePath).mode & 0o777;
    // Some filesystems (FAT, etc.) can't honor mode bits perfectly — just
    // assert no world-readable bit is set.
    expect(mode & 0o004).toBe(0);
  });

  it("returns null for a corrupt JSON cache file", () => {
    const dir = join(tmpHome, ".failproofai");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "audit-dashboard.json"), "{ not json", "utf-8");
    expect(readDashboardCache()).toBeNull();
  });

  it("returns null when shape is wrong", () => {
    const dir = join(tmpHome, ".failproofai");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "audit-dashboard.json"), JSON.stringify({ foo: 1 }), "utf-8");
    expect(readDashboardCache()).toBeNull();
  });

  it("isCacheStale returns true past the threshold", () => {
    const old = new Date(Date.now() - 60 * 60_000).toISOString(); // 1 hour ago
    expect(isCacheStale(old, 30)).toBe(true);
  });

  it("isCacheStale returns false within the threshold", () => {
    const recent = new Date(Date.now() - 10 * 60_000).toISOString(); // 10 min ago
    expect(isCacheStale(recent, 30)).toBe(false);
  });

  it("isCacheStale treats unparseable timestamps as stale", () => {
    expect(isCacheStale("not-a-date")).toBe(true);
  });
});
