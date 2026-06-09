/**
 * Shared atomic-write helper for JSON files we want crash-safe.
 *
 * Replaces two near-identical implementations in `lib/auth/auth-store.ts`
 * and `src/audit/dashboard-cache.ts`. Promoted to a shared module so the
 * "temp file → chmod → rename → reassert perms" dance is in one place;
 * the alternative is more drift like the prior PR where dashboard-cache
 * shipped the non-atomic plain `writeFileSync` path.
 *
 * Contract:
 *  - Concurrent writers can race on the rename, but neither observer
 *    sees a half-written file.
 *  - `mode` (default 0o600) is enforced on both the temp and final paths.
 *  - Parent directory is created with the same `mode` masked to 0o700
 *    if it doesn't exist.
 *  - Throws on hard failure; caller decides whether to swallow or surface.
 */
import {
  chmodSync,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";

export interface WriteJsonOptions {
  /** Permission mode for the final file (default 0o600). */
  mode?: number;
  /** Permission mode used when creating the parent dir (default 0o700). */
  dirMode?: number;
}

export function writeJsonAtomically(
  filePath: string,
  value: unknown,
  opts: WriteJsonOptions = {},
): void {
  const mode = opts.mode ?? 0o600;
  const dirMode = opts.dirMode ?? 0o700;
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: dirMode });
  const tmp = `${filePath}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(value, null, 2), { mode });
    try {
      if ((statSync(tmp).mode & 0o077) !== 0) chmodSync(tmp, mode);
    } catch {
      // best-effort
    }
    renameSync(tmp, filePath);
    // Re-assert perms on the final path — rename preserves the temp's
    // mode, but a pre-existing file's inode could have been observed in
    // the gap.
    try {
      if ((statSync(filePath).mode & 0o077) !== 0) chmodSync(filePath, mode);
    } catch {
      // best-effort
    }
  } catch (err) {
    try { rmSync(tmp, { force: true }); } catch { /* ignore */ }
    throw err;
  }
}
