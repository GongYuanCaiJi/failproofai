/**
 * Whole-result cache for the Next.js dashboard's `/audit` page.
 *
 * Stored at `~/.failproofai/audit-dashboard.json` with mode 0600. Single
 * slot — a new run with different params overwrites the previous entry.
 * Read by `app/actions/get-audit-result.ts` (server action) and written by
 * `app/api/audit/run/route.ts` on successful run completion.
 *
 * Separate from the per-transcript cache at `~/.failproofai/cache/audit/`
 * (see `src/audit/cache.ts`): that one makes re-running fast; this one
 * makes navigating back to /audit instant without re-running.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { AuditResult, RunAuditOptions } from "./types";

const DEFAULT_MAX_AGE_MINUTES = 30;

export interface DashboardCacheEntry {
  /** ISO timestamp the cache was written at. */
  cachedAt: string;
  /** The exact RunAuditOptions the cached result was produced with. */
  params: RunAuditOptions;
  /** The full `AuditResult` from `runAudit()`. */
  result: AuditResult;
}

function getCachePath(): string {
  return join(homedir(), ".failproofai", "audit-dashboard.json");
}

/** Read the cache file. Returns null on missing/corrupt/unreadable file —
 *  callers treat "no cache" as the empty state. */
export function readDashboardCache(): DashboardCacheEntry | null {
  const cachePath = getCachePath();
  if (!existsSync(cachePath)) return null;
  try {
    const raw = readFileSync(cachePath, "utf-8");
    const entry = JSON.parse(raw) as DashboardCacheEntry;
    if (
      typeof entry?.cachedAt !== "string"
      || typeof entry?.params !== "object"
      || typeof entry?.result !== "object"
    ) {
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

/** Write the cache file. Best-effort — swallows errors so a failed write
 *  never breaks the run path. Sets mode 0600 at file-create time to avoid
 *  leaving the file readable during the umask-default window. */
export function writeDashboardCache(params: RunAuditOptions, result: AuditResult): void {
  const cachePath = getCachePath();
  try {
    mkdirSync(dirname(cachePath), { recursive: true });
    const entry: DashboardCacheEntry = {
      cachedAt: new Date().toISOString(),
      params,
      result,
    };
    writeFileSync(cachePath, JSON.stringify(entry, null, 2), { encoding: "utf-8", mode: 0o600 });
    try { chmodSync(cachePath, 0o600); } catch { /* belt-and-suspenders on POSIX */ }
  } catch {
    // Cache writes are best-effort.
  }
}

/** True when the cache is older than `maxAgeMinutes` (default 30). The
 *  dashboard doesn't auto-refresh on stale cache — staleness only drives
 *  the "Re-run" affordance hint. */
export function isCacheStale(cachedAt: string, maxAgeMinutes: number = DEFAULT_MAX_AGE_MINUTES): boolean {
  const cachedMs = new Date(cachedAt).getTime();
  if (Number.isNaN(cachedMs)) return true;
  const ageMs = Date.now() - cachedMs;
  return ageMs > maxAgeMinutes * 60_000;
}
