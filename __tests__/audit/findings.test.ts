// @vitest-environment node
import { describe, it, expect } from "vitest";
import { deriveFindings } from "../../src/audit/findings";
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
    transcripts: { scanned: 0, skipped: 0, errors: 0, durationMs: 0 },
    results: rows,
    totals: { hits: rows.reduce((s, r) => s + r.hits, 0), projectsWithHits: 0 },
    projectsScanned: [],
    eventsScanned: 0,
    enabledBuiltinNames: [],
    ...extras,
  };
}

describe("deriveFindings", () => {
  it("ranks by hits desc and drops zero-hit rows", () => {
    const cards = deriveFindings(mkResult([
      mkRow("failproofai/block-rm-rf", 3),
      mkRow("failproofai/block-sudo", 0),       // dropped
      mkRow("failproofai/block-curl-pipe-sh", 9),
    ]));
    expect(cards.map((c) => c.sourceSlug)).toEqual([
      "block-curl-pipe-sh",
      "block-rm-rf",
    ]);
    expect(cards[0].num).toBe("01");
    expect(cards[1].num).toBe("02");
  });

  it("remaps a detector to its prescribed-fix policy slug", () => {
    const [card] = deriveFindings(mkResult([
      mkRow("redundant-cd-cwd", 4, { source: "audit-detector" }),
    ]));
    expect(card.sourceSlug).toBe("redundant-cd-cwd");
    expect(card.policy).toBe("warn-repeated-tool-calls");
    expect(card.fix.slug).toBe("warn-repeated-tool-calls");
    expect(card.fix.install).toContain("warn-repeated-tool-calls");
  });

  it("attaches `alsoCoveredBy` when the detector mapping carries an extra policy", () => {
    const [card] = deriveFindings(mkResult([
      mkRow("prefer-write-over-heredoc", 2, { source: "audit-detector" }),
    ]));
    expect(card.fix.alsoCoveredBy).toBe("block-secrets-write");
  });

  it("marks the fix as already-enabled when the policy is in the enabled set", () => {
    const cards = deriveFindings(mkResult(
      [mkRow("redundant-cd-cwd", 4, { source: "audit-detector" })],
      { enabledBuiltinNames: ["warn-repeated-tool-calls"] },
    ));
    expect(cards[0].alreadyEnabled).toBe(true);
  });

  it("marks already-enabled when a builtin row reports enabledInConfig", () => {
    const [card] = deriveFindings(mkResult([
      mkRow("failproofai/block-rm-rf", 1, { enabledInConfig: true }),
    ]));
    expect(card.alreadyEnabled).toBe(true);
  });

  it("falls back to displayTitle/impact copy when no hand-written copy exists", () => {
    const [card] = deriveFindings(mkResult([
      mkRow("failproofai/some-unknown-policy", 2, {
        displayTitle: "Some unknown policy",
        impact: "explains the impact",
      }),
    ]));
    expect(card.body).toBe("explains the impact");
    expect(card.cost).toBe("explains the impact");
  });

  it("injects a placeholder evidence entry when no examples were captured", () => {
    const [card] = deriveFindings(mkResult([
      mkRow("failproofai/block-rm-rf", 1, { examples: [] }),
    ]));
    expect(card.evidence).toHaveLength(1);
    expect(card.evidence[0].kind).toBe("comment");
  });

  it("renders a relative-time lastSeen", () => {
    // 2h ago
    const iso = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
    const [card] = deriveFindings(mkResult([
      mkRow("failproofai/block-rm-rf", 1, { lastSeen: iso }),
    ]));
    expect(card.lastSeen).toMatch(/^\d+h ago$/);
  });

  it("returns em-dash when lastSeen is missing", () => {
    const [card] = deriveFindings(mkResult([
      mkRow("failproofai/block-rm-rf", 1),
    ]));
    expect(card.lastSeen).toBe("—");
  });
});
