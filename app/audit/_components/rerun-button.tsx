"use client";

/**
 * Re-run button + polling. Click:
 *   1. POSTs /api/audit/run with the current scan params
 *   2. Polls /api/audit/status every 1s
 *   3. When `running` flips false (or `triggerRun` throws), the parent
 *      refetches the cache and the button surfaces success / failure.
 *
 * On 409 (audit already running) we just start polling without re-posting —
 * lets the user "join" an in-flight run that someone else (or a previous
 * tab) kicked off.
 *
 * Exports `triggerRun` separately so the empty-state CTA reuses the same
 * fetch logic without re-implementing. `triggerRun` throws on
 * unrecoverable failure (POST not OK and not 409, or the poll loop times
 * out) so callers can render a distinct "rerun failed" state instead of
 * pretending the run completed.
 */
import React, { useState } from "react";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePostHog } from "@/contexts/PostHogContext";

export interface ScanParams {
  /** Empty array = all CLIs. */
  cli: string[];
  /** "7d" | "30d" | "90d" | "all" (or any value accepted by parseSinceOpt). */
  since: string;
}

interface Props {
  scanParams: ScanParams;
  running: boolean;
  onStarted: () => void;
  onCompleted: () => Promise<void> | void;
}

const POLL_INTERVAL_MS = 1000;
const MAX_POLL_MS = 5 * 60_000; // 5 min hard cap

function paramsToBody(p: ScanParams) {
  return {
    cli: p.cli.length > 0 ? p.cli : undefined,
    since: p.since === "all" ? undefined : p.since,
  };
}

export class RerunError extends Error {
  readonly kind: "post_failed" | "network" | "timeout";
  constructor(kind: RerunError["kind"], message: string) {
    super(message);
    this.kind = kind;
    this.name = "RerunError";
  }
}

/** Fire a run and resolve once the server reports it finished. Used both by
 *  this button and by the EmptyState's "Run audit" CTA. Throws `RerunError`
 *  on POST failure, network failure, or poll-loop timeout — callers should
 *  catch and show a distinct failure state. */
export async function triggerRun(scanParams: ScanParams): Promise<void> {
  // Kick off the run. 409 (already running) is OK — we'll just poll.
  try {
    const res = await fetch("/api/audit/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(paramsToBody(scanParams)),
    });
    if (!res.ok && res.status !== 409) {
      const text = await res.text().catch(() => "");
      console.error("audit run failed:", res.status, text);
      throw new RerunError("post_failed", `audit run failed (${res.status})`);
    }
  } catch (err) {
    if (err instanceof RerunError) throw err;
    console.error("audit run request failed:", err);
    throw new RerunError("network", "audit run request failed");
  }

  // Poll status until running flips false.
  const startedAt = Date.now();
  while (Date.now() - startedAt < MAX_POLL_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    try {
      const sres = await fetch("/api/audit/status", { cache: "no-store" });
      if (!sres.ok) continue;
      const s = await sres.json() as { running: boolean };
      if (!s.running) return;
    } catch {
      // Transient — keep polling.
    }
  }
  throw new RerunError("timeout", "audit poll loop timed out");
}

export function RerunButton({ scanParams, running, onStarted, onCompleted }: Props) {
  const { capture } = usePostHog();
  const [failed, setFailed] = useState(false);
  const handle = async () => {
    setFailed(false);
    onStarted();
    let threw = false;
    try {
      await triggerRun(scanParams);
    } catch (err) {
      threw = true;
      const kind = err instanceof RerunError ? err.kind : "network";
      capture("audit_rerun_failed", {
        kind,
        source: "rerun_button",
        since: scanParams.since,
        cli_filter: scanParams.cli.length > 0 ? scanParams.cli.join(",") : "all",
      });
    } finally {
      if (threw) {
        setFailed(true);
        setTimeout(() => setFailed(false), 4000);
      }
      await onCompleted();
    }
  };

  const label = running ? "scanning…" : failed ? "rerun failed — retry" : "re-run";

  return (
    <button
      type="button"
      disabled={running}
      onClick={handle}
      className={cn(
        "font-mono text-[12px] inline-flex items-center gap-1.5 h-8 px-3 border transition-colors",
        running
          ? "text-[var(--chart-2)] border-[var(--chart-2)]/40 bg-[var(--chart-2)]/[0.08] cursor-wait"
          : failed
            ? "text-[var(--accent-pink)] border-[var(--accent-pink)]/60 hover:bg-card bg-transparent"
            : "text-foreground border-foreground/30 hover:border-foreground/60 hover:bg-card bg-transparent",
      )}
    >
      <RotateCw className={cn("w-3 h-3", running && "animate-spin")} />
      {label}
    </button>
  );
}
