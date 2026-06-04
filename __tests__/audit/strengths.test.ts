// @vitest-environment node
import { describe, it, expect } from "vitest";
import { deriveStrengths } from "../../src/audit/strengths";
import type { AuditCount, AuditResult } from "../../src/audit/types";

function mkRow(name: string, hits: number, opts: Partial<AuditCount> = {}): AuditCount {
  return {
    name,
    source: "builtin",
    category: "test",
    severity: "warn",
    hits,
    projects: 1,
    examples: [],
    displayTitle: name,
    impact: "",
    enabledInConfig: false,
    installHint: "",
    ...opts,
  };
}

function mkResult(rows: AuditCount[], extras: Partial<AuditResult> = {}): AuditResult {
  return {
    version: 2,
    scannedAt: "2026-06-01T00:00:00.000Z",
    scope: { cli: ["claude"], projects: "all", since: null },
    transcripts: { scanned: 1, skipped: 0, errors: 0, durationMs: 0 },
    results: rows,
    totals: { hits: rows.reduce((s, r) => s + r.hits, 0), projectsWithHits: 0 },
    projectsScanned: [],
    eventsScanned: 0,
    enabledBuiltinNames: [],
    ...extras,
  };
}

describe("deriveStrengths", () => {
  it("never returns more than 5 strengths", () => {
    // A truly clean audit hits every absence-style strength.
    const out = deriveStrengths(mkResult([], { eventsScanned: 100 }));
    expect(out.length).toBeLessThanOrEqual(5);
  });

  it("leads with a clean-rate headline when there were events", () => {
    const out = deriveStrengths(mkResult([], { eventsScanned: 200 }));
    expect(out[0].unit).toBe("clean tool calls");
    expect(out[0].metric).toBe("100%");
  });

  it("computes clean-rate from events - hits", () => {
    const out = deriveStrengths(mkResult(
      [mkRow("failproofai/block-rm-rf", 5)],
      { eventsScanned: 100 },
    ));
    // 95 / 100 = 95% clean
    expect(out[0].metric).toBe("95%");
  });

  it("gates the credential strength on every credential-class policy being silent", () => {
    const out = deriveStrengths(mkResult(
      [mkRow("failproofai/block-env-files", 2)],
      { eventsScanned: 50 },
    ));
    expect(out.some((s) => s.unit === "credential leaks")).toBe(false);
  });

  it("includes the credential strength when every credential-class policy is silent", () => {
    const out = deriveStrengths(mkResult([], { eventsScanned: 50 }));
    expect(out.some((s) => s.unit === "credential leaks")).toBe(true);
  });

  it("gates retry-storm strength on warn-repeated-tool-calls + sleep-polling-loop being silent", () => {
    const out = deriveStrengths(mkResult(
      [mkRow("failproofai/warn-repeated-tool-calls", 4)],
      { eventsScanned: 30 },
    ));
    expect(out.some((s) => s.unit === "retry storms")).toBe(false);
  });

  it("gates push-to-main strength on every git-mistake policy being silent", () => {
    const out = deriveStrengths(mkResult(
      [mkRow("failproofai/block-push-master", 1)],
      { eventsScanned: 30 },
    ));
    expect(out.some((s) => s.unit === "push-to-main attempts")).toBe(false);
  });

  it("surfaces a fallback 'audit complete' row when too few strengths qualified", () => {
    // Hits in every absence category so every absence-strength is gated out.
    const out = deriveStrengths(mkResult([
      mkRow("failproofai/block-env-files", 1),
      mkRow("failproofai/warn-repeated-tool-calls", 1),
      mkRow("failproofai/block-push-master", 1),
      mkRow("failproofai/reread-after-edit", 1),
    ], { eventsScanned: 0, transcripts: { scanned: 0, skipped: 0, errors: 0, durationMs: 0 } }));
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out.some((s) => s.headline === "audit complete.")).toBe(true);
  });
});
