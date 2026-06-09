/**
 * Shared fetch wrapper with per-request timeout via AbortController.
 *
 * Replaces three byte-equivalent implementations that had drifted on the
 * default timeout (15s in two client components, 10s in the server-side
 * api-server-client). Co-locates the `isAbortError` predicate so callers
 * can classify timeout vs network failures consistently.
 *
 * Server-side uses `AbortSignal.timeout` where available (cheaper); this
 * helper uses the AbortController+setTimeout form because the client
 * code-paths need a guaranteed cleanup hook.
 */

/** Hard cap on every fetch using this helper unless overridden. Picked to
 *  exceed the server-side `REQUEST_TIMEOUT_MS` (10s) in `api-server-client.ts`
 *  so a slow but successful upstream response still lands. */
export const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/** True when an error came from an AbortController.abort() OR a
 *  `AbortSignal.timeout` firing. Both surface as `Error` with `name`
 *  set to "AbortError" or "TimeoutError" respectively. Keeping the two
 *  in one predicate prevents the "I forgot TimeoutError" drift class. */
export function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error
    && (err.name === "AbortError" || err.name === "TimeoutError")
  );
}
