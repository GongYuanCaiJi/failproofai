"use client";

/**
 * Re-run button + polling. Click:
 *   1. POSTs /api/audit/run with the current scan params
 *   2. Polls /api/audit/status every 1s
 *   3. When `running` flips false, the parent refetches the cache
 *
 * On 409 (audit already running) we just start polling without re-posting —
 * lets the user "join" an in-flight run that someone else (or a previous
 * tab) kicked off.
 *
 * Exports `triggerRun` separately so the empty-state CTA reuses the same
 * fetch logic without re-implementing.
 */
import React from "react";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

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

/** Fire a run and resolve once the server reports it finished. Used both by
 *  this button and by the EmptyState's "Run audit" CTA. */
export async function triggerRun(scanParams: ScanParams): Promise<void> {
  // Kick off the run. 409 (already running) is OK — we'll just poll.
  try {
    const res = await fetch("/api/audit/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(paramsToBody(scanParams)),
    });
    if (!res.ok && res.status !== 409) {
      // Surface the error message but don't throw — the caller's finally
      // still runs and the UI returns to its previous state.
      const text = await res.text().catch(() => "");
      console.error("audit run failed:", res.status, text);
      return;
    }
  } catch (err) {
    console.error("audit run request failed:", err);
    return;
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
}

export function RerunButton({ scanParams, running, onStarted, onCompleted }: Props) {
  const handle = async () => {
    onStarted();
    try {
      await triggerRun(scanParams);
    } finally {
      await onCompleted();
    }
  };

  return (
    <button
      type="button"
      disabled={running}
      onClick={handle}
      className={cn(
        "font-mono text-[12px] inline-flex items-center gap-1.5 h-8 px-3 border transition-colors",
        running
          ? "text-[var(--chart-2)] border-[var(--chart-2)]/40 bg-[var(--chart-2)]/[0.08] cursor-wait"
          : "text-foreground border-foreground/30 hover:border-foreground/60 hover:bg-card bg-transparent",
      )}
    >
      <RotateCw className={cn("w-3 h-3", running && "animate-spin")} />
      {running ? "scanning…" : "re-run"}
    </button>
  );
}
