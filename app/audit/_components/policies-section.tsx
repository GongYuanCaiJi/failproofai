"use client";

/**
 * Section 05 — PRESCRIBED POLICIES. "enable these. close the gap."
 *
 * Grid of unenabled-builtin cards with install commands + projected
 * score uplift callout.
 *
 * Sources two layers of "hits":
 *   1. Unenabled builtin policies that fired on their own
 *   2. Audit detectors → mapped via DETECTOR_TO_POLICY in findings.ts.
 *      The detector's hits get attributed to its primary policy so the
 *      report frames everything as failproofai-coverable.
 *
 * Same policy can collect hits from multiple sources; we sum them and
 * render one card per policy.
 */
import React, { useState } from "react";
import type { AuditResult } from "@/src/audit/types";
import { type Grade, tierName } from "@/src/audit/scoring";
import { usePostHog } from "@/contexts/PostHogContext";

interface Props {
  result: AuditResult;
  projected: number;
  projectedGrade: Grade;
}

// Mirror of DETECTOR_TO_POLICY in findings.ts. Could re-export but keep
// the dependency tree shallow — both modules are stable.
const DETECTOR_TO_PRIMARY_POLICY: Record<string, string> = {
  "redundant-cd-cwd":          "warn-repeated-tool-calls",
  "prefer-edit-over-read-cat": "block-read-outside-cwd",
  "prefer-edit-over-sed-awk":  "warn-repeated-tool-calls",
  "prefer-write-over-heredoc": "block-env-files",
  "sleep-polling-loop":        "warn-background-process",
  "find-from-root":            "block-read-outside-cwd",
  "git-commit-no-verify":      "warn-git-amend",
  "reread-after-edit":         "warn-repeated-tool-calls",
};

const POLICY_DESC: Record<string, string> = {
  "warn-repeated-tool-calls": "warns when the same tool is called 3+ times with identical parameters — catches the loops before they spiral.",
  "block-read-outside-cwd":   "denies any file read whose absolute path falls outside the project root, including symlinks.",
  "block-env-files":          "blocks reads and writes of `.env` files at the tool layer.",
  "block-secrets-write":      "blocks writes to .pem, id_rsa, credentials.json, and other secret-key files.",
  "warn-background-process":  "warns before starting nohup / & / screen / tmux / disown processes that get forgotten about.",
  "warn-git-amend":           "warns before amending git commits — dangerous-commit-flag class.",
  "require-ci-green-before-stop": "requires CI checks to pass on HEAD before the agent declares the task done.",
};

function shortName(name: string): string {
  const slash = name.indexOf("/");
  return slash >= 0 ? name.slice(slash + 1) : name;
}

interface PolicyCard {
  name: string;        // short slug
  desc: string;        // displayTitle (low-res) or impact
  catches: string;     // "would have caught X occurrences..." copy
  hits: number;
}

function buildPolicyCards(result: AuditResult): PolicyCard[] {
  const enabledSet = new Set(result.enabledBuiltinNames ?? []);
  // policyName → aggregated counts
  const buckets = new Map<string, { hits: number; projects: number; sources: Set<string> }>();

  for (const row of result.results) {
    if (row.hits === 0) continue;

    let target: string;
    let isFromDetector = false;
    if (row.source === "audit-detector") {
      const mapped = DETECTOR_TO_PRIMARY_POLICY[shortName(row.name)];
      if (!mapped) continue;
      target = mapped;
      isFromDetector = true;
    } else if (row.source === "builtin" && !row.enabledInConfig) {
      target = shortName(row.name);
    } else {
      continue; // already-enabled builtins don't need to be prescribed
    }

    // Skip if the target policy is already in the user's enabled set
    // (detector hits would land there in production already).
    if (enabledSet.has(target)) continue;

    const bucket = buckets.get(target) ?? { hits: 0, projects: 0, sources: new Set() };
    bucket.hits += row.hits;
    bucket.projects = Math.max(bucket.projects, row.projects);
    bucket.sources.add(isFromDetector ? shortName(row.name) : "self");
    buckets.set(target, bucket);
  }

  return [...buckets.entries()]
    .sort((a, b) => b[1].hits - a[1].hits)
    .map(([name, b]) => {
      const viaList = [...b.sources].filter((s) => s !== "self");
      const viaCopy = viaList.length > 0
        ? ` (via ${viaList.join(", ")})`
        : "";
      const catches = `would have caught ${b.hits} occurrence${b.hits === 1 ? "" : "s"} across ${b.projects} project${b.projects === 1 ? "" : "s"}${viaCopy}.`;
      return {
        name,
        desc: POLICY_DESC[name] ?? "enable this builtin policy to close the gap.",
        catches,
        hits: b.hits,
      };
    });
}

export function PoliciesSection({ result, projected, projectedGrade }: Props) {
  const policies = buildPolicyCards(result);

  if (policies.length === 0) return null;

  return (
    <section className="section" data-screen-label="05 Policies">
      <div className="section-mast">
        <div className="section-label">
          <span className="glyph">━━</span> policies{" "}
          <span style={{ color: "var(--dim)" }}>·</span> prescribed
        </div>
        <div className="section-meta">
          {policies.length} polic{policies.length === 1 ? "y" : "ies"}{" "}
          <span style={{ color: "var(--dim)" }}>·</span>{" "}
          <span className="g">covers your slipping-through hits</span>
        </div>
      </div>
      <h2 className="section-h">enable these. close the gap.</h2>

      <div className="policy-callout">
        <span>
          enable all {policies.length === 1 ? "one" : policies.length}
        </span>
        <span className="arrow">→</span>
        <span>projected score</span>
        <span className="new-score">{projected}</span>
        <span style={{ color: "var(--dim)" }}>·</span>
        <span className="new-tier">{tierName(projectedGrade)}</span>
      </div>

      <div className="policies-grid">
        {policies.map((p, i) => (
          <PolicyTile key={p.name} policy={p} idx={i} />
        ))}
      </div>
    </section>
  );
}

function PolicyTile({ policy, idx }: { policy: PolicyCard; idx: number }) {
  const { capture } = usePostHog();
  const [copied, setCopied] = useState(false);
  const install = `failproof policy add ${policy.name}`;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(install);
      setCopied(true);
      capture("audit_copy_clicked", {
        source: "policies_section",
        item_type: "single_policy_install_command",
        policy_name: policy.name,
        policy_rank: idx + 1,
      });
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <article className="policy-card">
      <div className="head">
        <div className="policy-name">{policy.name}</div>
        <div className="policy-slug">№{String(idx + 1).padStart(2, "0")}</div>
      </div>
      <div className="policy-desc">{policy.desc}</div>
      <div className="policy-impact">
        <span className="check">✓</span>{policy.catches}
      </div>
      <div className="policy-install">
        <span className="prompt">$</span>
        <span>{install}</span>
        <span className="copy" onClick={handleCopy}>
          {copied ? "copied" : "copy"}
        </span>
      </div>
    </article>
  );
}
