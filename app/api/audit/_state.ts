/**
 * Shared in-memory state between `/api/audit/run` and `/api/audit/status`.
 *
 * A single audit can take 10-30 seconds; the client UI needs to know whether
 * one is in flight (to disable the re-run button and show a progress UI).
 * Both API routes import the same module-level state from here so they
 * agree on what "running" means.
 *
 * Caveats this lock does NOT cover:
 *
 *  - **Next.js dev-mode HMR** can reset module state mid-run; the status
 *    endpoint will then report `running: false` while the original POST
 *    handler is still resolving. Production is unaffected.
 *
 *  - **Multi-worker (`next start` with PM2 cluster mode, or any
 *    multi-process Node deploy)**: the lock is per-process. Two POSTs
 *    that land on different workers will both succeed, both invoke
 *    `runAudit()`, and one result will overwrite the other in the cache
 *    file. A correct cross-worker lock needs external storage (Redis,
 *    DB row, filesystem lock) and is out of scope for the OSS dashboard,
 *    which expects a single worker process by default.
 *
 *  - **Process death mid-run** (OOM, SIGKILL, uncaught throw past the
 *    route handler's `try/finally`) would wedge the lock forever in a
 *    long-lived worker. The `LOCK_MAX_AGE_MS` auto-expiry below treats
 *    a lock older than 5 minutes as released so the next caller can
 *    take over. 5 minutes matches the rerun-button poll cap, so a real
 *    in-flight run that exceeds it is also stuck and worth pre-empting.
 */
export interface RunState {
  /** True while a `runAudit()` call is in flight (and the lock hasn't
   *  expired — see `LOCK_MAX_AGE_MS`). */
  running: boolean;
  /** ms timestamp the current run was kicked off, if `running`. */
  startedAt?: number;
}

/** Auto-expire a wedged lock after this many ms. Matches the
 *  rerun-button's `MAX_POLL_MS`. */
const LOCK_MAX_AGE_MS = 5 * 60_000;

const state: RunState = { running: false };

function expiredIfStale(): void {
  if (!state.running) return;
  if (state.startedAt === undefined) return;
  if (Date.now() - state.startedAt > LOCK_MAX_AGE_MS) {
    state.running = false;
    state.startedAt = undefined;
  }
}

export function getRunState(): RunState {
  expiredIfStale();
  return { ...state };
}

/** Atomically attempt to take the run lock. Returns true if the caller
 *  acquired it; false if a run is already in progress. */
export function tryAcquireRun(): boolean {
  expiredIfStale();
  if (state.running) return false;
  state.running = true;
  state.startedAt = Date.now();
  return true;
}

/** Release the run lock. Safe to call even when not held. */
export function releaseRun(): void {
  state.running = false;
  state.startedAt = undefined;
}
