// @vitest-environment node
import { describe, it, expect } from "vitest";
import { ARCHETYPES, classifyAgent, pickArchetypeVariant } from "../../src/audit/archetypes";
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

function mkResult(rows: AuditCount[]): AuditResult {
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
  };
}

describe("classifyAgent", () => {
  it("returns precision when there is no signal at all", () => {
    const cls = classifyAgent(mkResult([]));
    expect(cls.archetype).toBe("precision");
    expect(cls.secondary).toBe(ARCHETYPES.precision.secondary);
    expect(cls.totalSignal).toBe(0);
  });

  it("returns precision when every row is zero hits", () => {
    const cls = classifyAgent(mkResult([mkRow("failproofai/block-rm-rf", 0)]));
    expect(cls.archetype).toBe("precision");
  });

  it("returns goldfish for broad spread (≥5 archetypes, top-3 share < 60%)", () => {
    // Hand-built spread: 8 archetypes hit roughly evenly so top-3 ≤ 60%.
    const cls = classifyAgent(mkResult([
      mkRow("failproofai/block-rm-rf", 5),               // cowboy   x2.0 = 10
      mkRow("failproofai/block-read-outside-cwd", 8),    // explorer x1.2 = 9.6
      mkRow("failproofai/warn-large-file-write", 9),     // ghost    x1.0 = 9
      mkRow("redundant-cd-cwd", 9, { source: "audit-detector" }), // optimist x1.0 = 9
      mkRow("failproofai/warn-repeated-tool-calls", 6),  // hammer   x1.5 = 9
      mkRow("failproofai/reread-after-edit", 11),        // architect x0.8 = 8.8
    ]));
    expect(cls.archetype).toBe("goldfish");
    // Secondary should be the strongest signal so the UI can hint at it.
    expect(cls.secondary).toBeDefined();
  });

  it("promotes secondary when ≥40% of primary", () => {
    const cls = classifyAgent(mkResult([
      mkRow("failproofai/block-rm-rf", 5),         // cowboy x2.0 = 10
      mkRow("failproofai/block-env-files", 6),     // explorer x1.5 = 9 (>= 40% of 10)
    ]));
    expect(cls.archetype).toBe("cowboy");
    expect(cls.secondary).toBe("explorer");
  });

  it("falls back to authored secondary when runner-up < 40% of primary", () => {
    const cls = classifyAgent(mkResult([
      mkRow("failproofai/block-rm-rf", 10),        // cowboy x2.0 = 20
      mkRow("failproofai/block-env-files", 1),     // explorer x1.5 = 1.5 (< 40% of 20)
    ]));
    expect(cls.archetype).toBe("cowboy");
    expect(cls.secondary).toBe(ARCHETYPES.cowboy.secondary);
  });

  it("ignores rows whose policy name doesn't map to a signal", () => {
    const cls = classifyAgent(mkResult([
      mkRow("failproofai/some-future-unmapped-policy", 50),
    ]));
    // No mapped signal → still treated as the clean baseline.
    expect(cls.archetype).toBe("precision");
  });

  it("weights detector hits by hits × weight", () => {
    const cls = classifyAgent(mkResult([
      mkRow("sleep-polling-loop", 5, { source: "audit-detector" }), // hammer x1.2 = 6
    ]));
    expect(cls.archetype).toBe("hammer");
    expect(cls.weights.hammer).toBe(6);
  });
});

describe("pickArchetypeVariant", () => {
  it("returns the same variant for the same seed", () => {
    const a = pickArchetypeVariant("optimist", "my-project");
    const b = pickArchetypeVariant("optimist", "my-project");
    expect(a).toEqual(b);
  });

  it("can return different variants for different seeds", () => {
    const variants = new Set(
      ["a", "b", "c", "d", "e", "f"].map((s) => pickArchetypeVariant("optimist", s).tagline),
    );
    // Out of 6 seeds we expect at least 2 distinct taglines — the picker
    // would otherwise be effectively constant.
    expect(variants.size).toBeGreaterThan(1);
  });
});
