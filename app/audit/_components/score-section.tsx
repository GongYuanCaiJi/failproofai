"use client";

/**
 * Section 03 — SCORE CARD + SHARE.
 *
 * Replaces the older "Score + Leaderboard" composition. A single .panel
 * holds two columns:
 *
 *   left  — YOUR AUDIT SCORE (big number, tier badge, progress bar,
 *           3 stat boxes, prescribed-policies chip strip)
 *   right — SHARE YOUR RESULTS (X + LinkedIn pre-written templates,
 *           share-on-X / share-on-LinkedIn / download-audit-card buttons)
 *
 * "Download audit card" captures THIS panel via html2canvas — same
 * technique as ShowOffCTA but a different capture target — so the
 * exported PNG is the share card the user just saw.
 */
import React, { useMemo, useRef, useState } from "react";
import type { AuditResult } from "@/src/audit/types";
import { ARCHETYPES, type ArchetypeKey } from "@/src/audit/archetypes";
import { gradeFor, tierName, type Grade } from "@/src/audit/scoring";

interface Props {
  result: AuditResult;
  score: number;
  grade: Grade;
  cohort: number;
  archetypeKey: ArchetypeKey;
  /** Display name shown in the cohort masthead. */
  project: string;
}

interface ShareTemplate {
  network: "x" | "linkedin";
  label: string;
  body: string;
  intentUrl: (body: string) => string;
}

function buildXTemplate(score: number, archetypeName: string, grade: Grade, missing: number): string {
  const tier = grade === "B" || grade === "A" || grade === "S" ? grade : `${grade}`;
  return `omg just ran a @failproofai audit on my agent and scored ${score}/100. apparently i'm "${archetypeName.toLowerCase()}" (${tier.toLowerCase()} tier). ${missing} polic${missing === 1 ? "y" : "ies"} away from levelling up. if you ship ai agents you need to check this →`;
}

function buildLinkedInTemplate(score: number, archetypeName: string, missing: number): string {
  return `We just completed a FailproofAI audit on our agent infrastructure and scored ${score}/100. The audit surfaced ${missing} unaddressed policy gap${missing === 1 ? "" : "s"} around our ${archetypeName.toLowerCase()} workload. Highly recommend running this if you're operating AI agents in production — getting visibility into what your agents actually did was the unlock.`;
}

const SITE_URL = "https://befailproof.ai";

const X_INTENT = (body: string): string =>
  `https://x.com/intent/post?text=${encodeURIComponent(body + " " + SITE_URL)}`;
const LI_INTENT = (body: string): string =>
  `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL)}&summary=${encodeURIComponent(body)}`;

export function ScoreSection({ result, score, grade, cohort, archetypeKey, project }: Props) {
  const archetype = ARCHETYPES[archetypeKey];
  const pointsToNext = useMemo(() => {
    const thresholds: { g: Grade; t: number }[] = [
      { g: "S", t: 90 }, { g: "A", t: 80 }, { g: "B", t: 71 },
      { g: "C", t: 55 }, { g: "D", t: 40 },
    ];
    for (const { g, t } of thresholds) {
      if (score < t) return { next: g, delta: t - score };
    }
    return { next: "S" as Grade, delta: 0 };
  }, [score]);

  /** Slipping-through builtin policies (the same heuristic ReturnSection uses
   *  for its [install policies] CTA). Used as the "policies missing" stat. */
  const missing = useMemo(
    () => result.results.filter((r) => r.source === "builtin" && !r.enabledInConfig && r.hits > 0).length,
    [result],
  );

  /** Rough "days to fix" — capped 1..14. One day per slipping policy, with a
   *  baseline of 3d on any non-S grade. */
  const daysToFix = useMemo(() => {
    if (grade === "S" || missing === 0) return 0;
    return Math.max(1, Math.min(14, missing + 1));
  }, [grade, missing]);

  /** % of score-bar filled toward the next tier — used by the gradient bar. */
  const progressPct = useMemo(() => {
    if (pointsToNext.delta === 0) return 100;
    // Progress within the current tier band, e.g. between C (55) and B (71)
    const bands: { lo: number; hi: number }[] = [
      { lo: 90, hi: 100 }, { lo: 80, hi: 90 }, { lo: 71, hi: 80 },
      { lo: 55, hi: 71 }, { lo: 40, hi: 55 }, { lo: 0, hi: 40 },
    ];
    const band = bands.find((b) => score >= b.lo && score < b.hi) ?? bands[bands.length - 1];
    return Math.round(((score - band.lo) / (band.hi - band.lo)) * 100);
  }, [score, pointsToNext.delta]);

  /** Top-N slipping policies → chip strip on the left card. Capped at 6. */
  const policyChips = useMemo(() => {
    const slipping = result.results
      .filter((r) => r.source === "builtin" && !r.enabledInConfig && r.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 6)
      .map((r) => ({ name: shortPolicyLabel(r.name), missing: true as const }));
    const enabled = result.results
      .filter((r) => r.source === "builtin" && r.enabledInConfig)
      .slice(0, Math.max(0, 6 - slipping.length))
      .map((r) => ({ name: shortPolicyLabel(r.name), missing: false as const }));
    return [...slipping, ...enabled];
  }, [result]);

  /* ── share + download ── */
  const xTemplate = useMemo(
    () => buildXTemplate(score, archetype.name, grade, missing),
    [score, archetype.name, grade, missing],
  );
  const liTemplate = useMemo(
    () => buildLinkedInTemplate(score, archetype.name, missing),
    [score, archetype.name, missing],
  );

  const cardRef = useRef<HTMLDivElement>(null);
  const [downloadState, setDownloadState] = useState<"idle" | "busy" | "done" | "error">("idle");

  const handleDownload = async () => {
    const node = cardRef.current;
    if (!node || downloadState === "busy") return;
    setDownloadState("busy");
    try {
      if (typeof document !== "undefined" && document.fonts?.ready) await document.fonts.ready;
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(node, {
        backgroundColor: "#0e0e11",
        scale: 2,
        logging: false,
        useCORS: true,
      });
      await new Promise<void>((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) { resolve(); return; }
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `failproofai-card-${grade.toLowerCase()}-${score}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          resolve();
        }, "image/png");
      });
      setDownloadState("done");
      setTimeout(() => setDownloadState("idle"), 2000);
    } catch (err) {
      console.error("card capture failed:", err);
      setDownloadState("error");
      setTimeout(() => setDownloadState("idle"), 2000);
    }
  };

  const templates: ShareTemplate[] = [
    { network: "x",        label: "x · twitter", body: xTemplate,  intentUrl: X_INTENT },
    { network: "linkedin", label: "linkedin",    body: liTemplate, intentUrl: LI_INTENT },
  ];

  return (
    <section className="section" data-screen-label="03 Score + share">
      <div className="section-mast">
        <div className="section-label">
          <span className="glyph">━━</span> score{" "}
          <span style={{ color: "var(--dim)" }}>·</span> share
        </div>
        <div className="section-meta">
          <span style={{ color: "var(--ink)" }}>{cohort.toLocaleString()}</span> agents
          <span style={{ color: "var(--dim)" }}> · </span>
          last 30 days
        </div>
      </div>
      <h2 className="section-h">your audit · ship it.</h2>

      <div className="panel score-share-card" ref={cardRef}>
        <div className="score-share-mast">
          <div className="ssm-left">
            <span style={{ color: "var(--accent-green)" }}>cohort</span>
            <span style={{ color: "var(--dim)" }}> · </span>
            last 30 days
            <span style={{ color: "var(--dim)" }}> · </span>
            <span style={{ color: "var(--ink)" }}>{cohort.toLocaleString()}</span> agents
          </div>
          <div className="ssm-right">
            <span style={{ color: "var(--ink)" }}>{project}</span>
            <span style={{ color: "var(--dim)" }}> · </span>
            <span style={{ color: "var(--accent-pink)" }}>{archetype.name.toLowerCase()}</span>
          </div>
        </div>

        <div className="score-share-body">
          {/* LEFT — score */}
          <div className="ss-left">
            <div className="ss-label">your audit score</div>
            <div className="ss-score-row">
              <span className={"ss-score g-" + grade}>{score}</span>
              <span className="ss-score-of">/100</span>
            </div>

            <div className="ss-tier-row">
              <span className={"ss-tier-badge g-" + grade}>{grade} tier</span>
              <span className="ss-arch">{archetype.name.toLowerCase()}</span>
            </div>

            {pointsToNext.delta > 0 ? (
              <>
                <div className="ss-progress-label">
                  <span style={{ color: "var(--accent-pink)" }}>
                    progress to {pointsToNext.next.toLowerCase()} tier
                  </span>
                  <span style={{ color: "var(--accent-pink)" }}>
                    +{pointsToNext.delta} pts needed
                  </span>
                </div>
                <div className="ss-progress-track">
                  <div
                    className="ss-progress-fill audit-bar-fill"
                    style={{ ["--bar-width" as string]: `${progressPct}%` }}
                  />
                </div>
              </>
            ) : (
              <div className="ss-progress-label" style={{ color: "var(--accent-green)" }}>
                top tier — keep policies live, revisit in 30d.
              </div>
            )}

            <div className="ss-stats">
              <div className="ss-stat">
                <div className="ss-stat-n" style={{ color: "var(--amber)" }}>{missing}</div>
                <div className="ss-stat-l">policies<br />missing</div>
              </div>
              <div className="ss-stat">
                <div className="ss-stat-n" style={{ color: "var(--accent-pink)" }}>
                  +{pointsToNext.delta}
                </div>
                <div className="ss-stat-l">pts to<br />next tier</div>
              </div>
              <div className="ss-stat">
                <div className="ss-stat-n" style={{ color: "var(--accent-green)" }}>
                  {daysToFix === 0 ? "—" : `~${daysToFix}d`}
                </div>
                <div className="ss-stat-l">est.<br />to fix</div>
              </div>
            </div>

            {policyChips.length > 0 && (
              <>
                <div className="ss-policy-label">policy status</div>
                <div className="ss-policy-chips">
                  {policyChips.map((p, i) => (
                    <span
                      key={i}
                      className={"ss-chip" + (p.missing ? " missing" : " enabled")}
                    >
                      <span className="dot" aria-hidden="true" />
                      {p.name}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* RIGHT — share */}
          <div className="ss-right">
            <div className="ss-label">share your results</div>

            <div className="ss-templates">
              {templates.map((t) => (
                <article key={t.network} className="ss-template">
                  <div className="ss-template-head">
                    <span className="dot" aria-hidden="true" />
                    {t.label}
                  </div>
                  <p className="ss-template-body">{t.body}</p>
                </article>
              ))}
            </div>

            <div className="ss-actions">
              {templates.map((t) => (
                <a
                  key={t.network}
                  className="ss-action-btn"
                  href={t.intentUrl(t.body)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="ss-action-glyph" aria-hidden="true">
                    {t.network === "x" ? "x" : "in"}
                  </span>
                  <span className="ss-action-text">
                    <span className="ss-action-title">share on {t.label.split(" ·")[0]}</span>
                    <span className="ss-action-sub">posts with pre-written copy + card</span>
                  </span>
                </a>
              ))}

              <button
                type="button"
                className="ss-action-btn"
                onClick={handleDownload}
                disabled={downloadState === "busy"}
              >
                <span className="ss-action-glyph" aria-hidden="true">↓</span>
                <span className="ss-action-text">
                  <span className="ss-action-title">
                    {downloadState === "busy"  ? "rendering…"
                      : downloadState === "done"  ? "downloaded ✓"
                      : downloadState === "error" ? "render failed"
                      : "download audit card"}
                  </span>
                  <span className="ss-action-sub">saves shareable image to your device</span>
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="ss-foot">
          <span>
            enable prescribed policies to reach {pointsToNext.next.toLowerCase()} tier this week.
          </span>
          <a href="#findings" className="ss-foot-link">view full report →</a>
        </div>
      </div>
    </section>
  );
}

/** Drop the "failproofai/" namespace prefix builtin policies carry so chips
 *  stay compact (`block-sudo` reads better than `failproofai/block-sudo`). */
function shortPolicyLabel(name: string): string {
  const slash = name.indexOf("/");
  return slash >= 0 ? name.slice(slash + 1) : name;
}
