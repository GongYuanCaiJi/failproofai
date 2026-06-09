"use client";

/**
 * Section 04 — FINDINGS. "your agent has some quirks."
 *
 * Per-finding cards with four blocks: what happened / what this costs /
 * evidence sample / the fix. Data sourced from `src/audit/findings.ts`.
 */
import React, { useState } from "react";
import type { FindingCard } from "@/src/audit/findings";
import { usePostHog } from "@/contexts/PostHogContext";

interface Props {
  findings: FindingCard[];
}

export function FindingsSection({ findings }: Props) {
  if (findings.length === 0) return null;

  return (
    <section className="section" data-screen-label="04 Findings">
      <div className="section-mast">
        <div className="section-label">
          <span className="glyph">━━</span> findings{" "}
          <span style={{ color: "var(--dim)" }}>·</span> ranked by impact
        </div>
        <div className="section-meta">
          <span className="p">●</span> {findings.length} detector{findings.length === 1 ? "" : "s"} triggered
        </div>
      </div>
      <h2 className="section-h">your agent has some quirks.</h2>

      <div className="findings-list">
        {findings.map((f) => <Finding key={f.sourceSlug} f={f} />)}
      </div>
    </section>
  );
}

function Finding({ f }: { f: FindingCard }) {
  const { capture } = usePostHog();
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(f.fix.install);
      setCopied(true);
      capture("audit_copy_clicked", {
        source: "findings_section",
        item_type: "single_policy_install_command",
        policy_name: f.fix.slug,
        finding_slug: f.sourceSlug,
      });
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <article className="finding">
      <header className="finding-head">
        <div className="finding-num">№{f.num}</div>
        <div className="finding-title">{f.title}</div>
        <div className="finding-count">
          {f.count}×
          <span className="label">occurrences</span>
        </div>
      </header>
      <div className="finding-meta">
        <span>
          <span style={{ color: "var(--dim)" }}>policy</span>{" "}
          <span className="policy">{f.policy}</span>
        </span>
        <span className="sep">·</span>
        <span>{f.projects} {f.projects === 1 ? "project" : "projects"}</span>
        <span className="sep">·</span>
        <span>last seen {f.lastSeen}</span>
        {f.alreadyEnabled && (
          <>
            <span className="sep">·</span>
            <span style={{ color: "var(--accent-green)" }}>enforced</span>
          </>
        )}
      </div>
      <div className="finding-body">
        <div className="finding-block">
          <div className="fb-label">what happened</div>
          <div className="fb-body">{f.body}</div>
        </div>
        <div className="finding-block">
          <div className="fb-label cost">what this costs</div>
          <div className="fb-body">{f.cost}</div>
        </div>
        <div className="finding-block">
          <div className="fb-label">evidence · sample</div>
          <div className="fb-evidence">
            {f.evidence.map((e, i) => {
              if (e.kind === "comment") {
                return <div key={i} className="comment">{e.text}</div>;
              }
              if (e.kind === "err") {
                return <div key={i} className="err">{e.text}</div>;
              }
              return (
                <div key={i}>
                  <span className="arrow">→ </span>
                  <span>{e.text}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="finding-block">
          <div className="fb-label fix">the fix</div>
          <div className="fb-fix">
            <span className="slug">{f.fix.slug}</span>
            <div style={{ color: "var(--ink-2)" }}>{f.fix.desc}</div>
            {f.fix.alsoCoveredBy && (
              <div style={{ color: "var(--dim)", fontSize: 11, marginTop: 4 }}>
                also covered by{" "}
                <span style={{ color: "var(--accent-green)" }}>{f.fix.alsoCoveredBy}</span>
              </div>
            )}
            <code className="cmd" onClick={handleCopy} style={{ cursor: "pointer" }}>
              <span className="prompt">$</span>{f.fix.install}{" "}
              <span style={{ color: "var(--dim)", marginLeft: 8, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                {copied ? "copied" : "click to copy"}
              </span>
            </code>
          </div>
        </div>
      </div>
    </article>
  );
}
