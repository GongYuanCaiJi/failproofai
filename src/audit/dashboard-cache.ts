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
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { AuditResult, RunAuditOptions } from "./types";

const DEFAULT_MAX_AGE_MINUTES = 30;

/**
 * Bump whenever the on-disk shape of a cached entry changes in a way the
 * reader can't tolerate (added required field, renamed key, swapped result
 * version). Entries written with a different `schemaVersion` are rejected
 * — better an empty state than rendering against the wrong shape.
 *
 * v2: AuditResult.version bumped 1→2 (added `projectsScanned`,
 * `eventsScanned`, `enabledBuiltinNames`). Renderers defaulted missing
 * fields silently, which masked a stale cache as "0 tool calls scanned"
 * instead of triggering the empty-state recovery. Rejecting v1 entries
 * forces a re-run.
 */
export const DASHBOARD_CACHE_SCHEMA_VERSION = 2;

export interface DashboardCacheEntry {
  /** Bumped whenever the cache shape changes incompatibly. */
  schemaVersion: number;
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
    // `typeof null === "object"`, so explicit null checks are required for
    // params and result — otherwise a corrupt cache like `{"params": null}`
    // would slip through and crash downstream readers.
    if (
      !entry
      || typeof entry !== "object"
      || typeof entry.cachedAt !== "string"
      || !entry.params
      || typeof entry.params !== "object"
      || !entry.result
      || typeof entry.result !== "object"
    ) {
      return null;
    }
    // Reject anything written by an older code version with a different
    // shape. The dashboard treats null as the "no cached result" empty
    // state, which is the safer fallback when we can't trust the bytes.
    if (entry.schemaVersion !== DASHBOARD_CACHE_SCHEMA_VERSION) {
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

/** Write the cache file atomically — temp-file then rename. Best-effort
 *  overall (swallows errors so a failed write never breaks the run path),
 *  but the temp-file dance protects concurrent readers (e.g. the 1s status
 *  poll firing while a fresh run writes a multi-hundred-KB AuditResult)
 *  from observing a torn JSON file. Sets mode 0600 on the temp file before
 *  rename so the cache is never world-readable during the umask window. */
export function writeDashboardCache(params: RunAuditOptions, result: AuditResult): void {
  const cachePath = getCachePath();
  const tmpPath = `${cachePath}.tmp`;
  try {
    mkdirSync(dirname(cachePath), { recursive: true, mode: 0o700 });
    const entry: DashboardCacheEntry = {
      schemaVersion: DASHBOARD_CACHE_SCHEMA_VERSION,
      cachedAt: new Date().toISOString(),
      params,
      result,
    };
    writeFileSync(tmpPath, JSON.stringify(entry, null, 2), { encoding: "utf-8", mode: 0o600 });
    try { chmodSync(tmpPath, 0o600); } catch { /* belt-and-suspenders on POSIX */ }
    try {
      if ((statSync(tmpPath).mode & 0o077) !== 0) chmodSync(tmpPath, 0o600);
    } catch { /* best-effort */ }
    renameSync(tmpPath, cachePath);
  } catch {
    // Cache writes are best-effort. Clean up the temp file if it leaked.
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
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
