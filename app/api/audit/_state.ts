/**
 * Shared in-memory state between `/api/audit/run` and `/api/audit/status`.
 *
 * A single audit can take 10-30 seconds; the client UI needs to know whether
 * one is in flight (to disable the re-run button and show a progress UI).
 * Both API routes import the same module-level state from here so they
 * agree on what "running" means.
 *
 * Caveat: Next.js dev mode HMR can reset module state mid-run; in that case
 * the status endpoint will report `running: false` even though the original
 * POST handler is still resolving. In production (`next start`/`bun start`)
 * the singleton holds for the lifetime of the worker process.
 */
export interface RunState {
  /** True while a `runAudit()` call is in flight. */
  running: boolean;
  /** ms timestamp the current run was kicked off, if `running`. */
  startedAt?: number;
}

const state: RunState = { running: false };

export function getRunState(): RunState {
  return { ...state };
}

/** Atomically attempt to take the run lock. Returns true if the caller
 *  acquired it; false if a run is already in progress. */
export function tryAcquireRun(): boolean {
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
