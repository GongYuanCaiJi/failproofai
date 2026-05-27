"use client";

/**
 * Two-mode empty state:
 *   - "no-cache" — first time the user visits /audit. CTA to run.
 *   - "zero-sessions" — ran a scan but no transcripts were found. Likely the
 *     user hasn't installed hooks for any CLI yet.
 */
import React from "react";
import { ClipboardCheck, FolderSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerRun } from "./rerun-button";

interface Props {
  mode: "no-cache" | "zero-sessions";
  running: boolean;
  onStarted: () => void;
  onCompleted: () => Promise<void> | void;
}

export function EmptyState({ mode, running, onStarted, onCompleted }: Props) {
  const handleRun = async () => {
    onStarted();
    try {
      await triggerRun({ cli: [], since: "30d" });
    } finally {
      await onCompleted();
    }
  };

  if (mode === "no-cache") {
    return (
      <div className="rounded-lg border border-border bg-card p-12 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-5">
          <ClipboardCheck className="w-7 h-7 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">No audit data yet</h2>
        <p className="text-sm text-muted-foreground max-w-md mb-6">
          Run your first audit to see how your agents have been behaving across all past sessions.
        </p>
        <Button variant="default" disabled={running} onClick={handleRun}>
          {running ? "Scanning…" : "Run audit"}
        </Button>
        <p className="text-[0.7rem] text-muted-foreground mt-3">
          Scans the last 30 days across every installed CLI. Takes 10–30 seconds.
        </p>
      </div>
    );
  }

  // mode === "zero-sessions"
  return (
    <div className="rounded-lg border border-border bg-card p-12 flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-5">
        <FolderSearch className="w-7 h-7 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-2">No sessions found</h2>
      <p className="text-sm text-muted-foreground max-w-md mb-2">
        Failproof AI couldn&apos;t find any transcripts to scan. Install the hooks
        for at least one CLI to start collecting sessions.
      </p>
      <a
        href="https://docs.befailproof.ai/getting-started"
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-primary hover:underline"
      >
        See the install guide →
      </a>
    </div>
  );
}
