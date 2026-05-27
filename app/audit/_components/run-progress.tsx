"use client";

/**
 * Fake-progress UI shown while /api/audit/run is in flight. runAudit() does
 * not emit granular progress events, so we animate through 4 plausible
 * stages on a fixed 4s interval. The user sees motion + a clear "this is
 * still working" signal.
 */
import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const STAGES = [
  { label: "Discovering transcripts", detail: "Walking ~/.claude, ~/.codex, ~/.cursor, …" },
  { label: "Parsing session logs", detail: "Reading JSONL + SQLite session stores" },
  { label: "Running policy checks", detail: "Replaying through 30 builtin policies" },
  { label: "Aggregating results", detail: "Counting hits, ranking by frequency" },
];

const STAGE_DURATION_MS = 4000;

export function RunProgress() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStage((s) => Math.min(s + 1, STAGES.length - 1));
    }, STAGE_DURATION_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-lg border border-border bg-card p-10 mt-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
        <h2 className="text-base font-semibold text-foreground">Scanning sessions…</h2>
      </div>
      <ul className="space-y-3">
        {STAGES.map((s, i) => {
          const done = i < stage;
          const active = i === stage;
          return (
            <li key={i} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-1 w-2 h-2 rounded-full shrink-0",
                  done && "bg-[var(--chart-2)]",
                  active && "bg-primary animate-pulse",
                  !done && !active && "bg-border",
                )}
              />
              <div>
                <div
                  className={cn(
                    "text-sm",
                    done && "text-muted-foreground line-through",
                    active && "text-foreground font-medium",
                    !done && !active && "text-muted-foreground/60",
                  )}
                >
                  {s.label}
                </div>
                {active && (
                  <div className="text-[0.7rem] text-muted-foreground mt-0.5">{s.detail}</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground mt-6">
        This usually takes 10–30 seconds depending on session history.
      </p>
    </div>
  );
}
