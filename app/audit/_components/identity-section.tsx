"use client";

/**
 * Section 01 — IDENTITY. The hero. Big archetype name with hard-offset
 * stamp shadow, sigil to the right, keywords strip, "common in / primary
 * risk" meta grid, and the closing one-liner.
 *
 * Layout uses the ported `.archetype-frame` / `.arch-mast` / `.arch-body`
 * classes from audit-styles.css. Data sources from `src/audit/archetypes.ts`.
 *
 * The variant copy (tagline / keywords / common / risk / closing) is
 * picked deterministically from a multi-variant catalog using the `seed`
 * prop — typically the inferred project name. Same seed → same persona
 * blurb across renders; different seeds → different copy. So two users
 * who both land on "the optimist" see different language for it.
 *
 * Exposes a `frameRef` forwarded onto the `.archetype-frame` element so
 * the ShowOff "make poster" action can capture it via html2canvas.
 */
import React, { forwardRef, useMemo, useState } from "react";
import { ARCHETYPES, pickArchetypeVariant, type ArchetypeKey } from "@/src/audit/archetypes";
import { type Grade } from "@/src/audit/scoring";
import { usePostHog } from "@/contexts/PostHogContext";
import { Sigil } from "./sigil";
import { copyOrDownloadCard, shareCardToastMessage } from "@/lib/share-card";
import { toast } from "@/app/components/toast";

const SITE_URL = "https://failproof.ai";
const X_INTENT = (text: string) =>
  `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
const LI_INTENT = (text: string) =>
  `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL)}&summary=${encodeURIComponent(text)}`;

function buildXTemplate(score: number, archetypeName: string, grade: Grade, missing: number): string {
  const gradeLines: Record<Grade, string> = {
    S: "every prescribed policy live. running at peak. this is what secure looks like.",
    A: `${missing} polic${missing === 1 ? "y" : "ies"} from elite tier. almost there.`,
    B: `solid baseline. ${missing} policy gap${missing === 1 ? "" : "s"} to close before i'm comfortable.`,
    C: `${missing} prescribed polic${missing === 1 ? "y" : "ies"} between here and the next tier. they're named. they're waiting.`,
    D: `${missing} prescribed polic${missing === 1 ? "y" : "ies"} unaddressed. agents without guardrails aren't ready for prod.`,
    F: `exposure is real. ${missing} polic${missing === 1 ? "y" : "ies"} away from stable ground — starting today.`,
  };
  return `just audited my AI agent with failproofai ✦\n\narchetype: ${archetypeName.toLowerCase()} · ${score}/100 · ${grade} tier\n${gradeLines[grade]}\n\nrun yours → ${SITE_URL}`;
}

function buildLinkedInTemplate(score: number, archetypeName: string, grade: Grade, missing: number): string {
  // "every key policy is live" is only true when the audit returned no
  // unenabled prescribed policies. A-grade with a non-zero `missing` count
  // is the "almost there but still has gaps" state — softer copy.
  const cleanRun = grade === "S" || (grade === "A" && missing === 0);
  const verdict = cleanRun
    ? `${score}/100 — ${grade} tier. every key policy is live. the audit confirmed what good looks like.`
    : `${score}/100 — ${grade} tier. ${missing} prescribed polic${missing === 1 ? "y" : "ies"} uncovered — each one is a real attack surface.`;
  return `We ran a failproofai security audit on our AI agent stack.\n\n${verdict}\n\nArchetype: ${archetypeName.toLowerCase()}. failproofai maps your agent\'s behavior pattern, identifies the exposure, and prescribes the exact policies to close it.\n\nFree. Open-source. 30 seconds to run: ${SITE_URL}`;
}

interface Props {
  archetypeKey: ArchetypeKey;
  secondaryKey: ArchetypeKey;
  toolCalls: number;
  sessions: number;
  /** "30d", "7d", etc. shown in the target line; "all time" otherwise. */
  window: string;
  /** Stable seed for variant selection (project name is the natural fit). */
  seed: string;
  score: number;
  grade: Grade;
  missing: number;
}

export const IdentitySection = forwardRef<HTMLDivElement, Props>(function IdentitySection(
  { archetypeKey, secondaryKey, toolCalls, sessions, window, seed, score, grade, missing }: Props,
  frameRef,
) {
  // `pickArchetypeVariant` re-hashes the seed string via djb2 + 4 mix
  // passes per axis. Deterministic over (archetypeKey, seed) so memoize
  // — the share buttons toggle `downloadState` which rerenders us 4×.
  const archetype = useMemo(
    () => pickArchetypeVariant(archetypeKey, seed),
    [archetypeKey, seed],
  );
  const secondary = secondaryKey !== archetypeKey ? ARCHETYPES[secondaryKey] : null;
  const { capture } = usePostHog();
  const [downloadState, setDownloadState] = useState<"idle" | "busy" | "done" | "error">("idle");

  /** Renders the archetype frame to a PNG blob via html2canvas. Returns
   *  `null` if the frame isn't mounted yet, capture failed, or the canvas
   *  produced no blob. Callers decide whether to copy-to-clipboard or
   *  download via the `lib/share-card.copyOrDownloadCard` helper. */
  const captureCardBlob = async (): Promise<Blob | null> => {
    const node = typeof frameRef === "function" ? null : frameRef?.current;
    if (!node) return null;
    node.classList.add("capturing");
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
      return await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/png");
      });
    } finally {
      node.classList.remove("capturing");
    }
  };

  const filenameFor = (channel: "x" | "linkedin" | "download") =>
    channel === "download"
      ? `failproofai-identity-${grade.toLowerCase()}-${score}.png`
      : `failproofai-${channel}-${grade.toLowerCase()}-${score}.png`;

  const handleDownload = async () => {
    if (downloadState === "busy") return;
    capture("audit_card_download_clicked", {
      score,
      grade,
      missing_policies: missing,
    });
    setDownloadState("busy");
    try {
      const blob = await captureCardBlob();
      if (!blob) {
        capture("audit_card_capture_completed", { trigger: "download", status: "no_frame", image_method: "failed" });
        toast(shareCardToastMessage("failed"));
        setDownloadState("error");
      } else {
        const method = await copyOrDownloadCard(blob, filenameFor("download"));
        capture("audit_card_capture_completed", { trigger: "download", status: "success", image_method: method });
        toast(shareCardToastMessage(method));
        setDownloadState(method === "failed" ? "error" : "done");
      }
    } catch {
      capture("audit_card_capture_completed", { trigger: "download", status: "error", image_method: "failed" });
      toast(shareCardToastMessage("failed"));
      setDownloadState("error");
    } finally {
      setTimeout(() => setDownloadState("idle"), 2000);
    }
  };

  const handleShareX = async () => {
    const text = buildXTemplate(score, archetype.name, grade, missing);
    capture("audit_card_share_clicked", {
      channel: "x",
      source: "identity",
      score,
      grade,
      missing_policies: missing,
    });
    const blob = await captureCardBlob().catch(() => null);
    const method = blob
      ? await copyOrDownloadCard(blob, filenameFor("x"))
      : "failed";
    capture("audit_card_capture_completed", {
      trigger: "share_x",
      status: blob ? "success" : "error",
      image_method: method,
    });
    toast(shareCardToastMessage(method));
    globalThis.open(X_INTENT(text), "_blank", "noopener,noreferrer");
  };

  const handleShareLI = async () => {
    const text = buildLinkedInTemplate(score, archetype.name, grade, missing);
    capture("audit_card_share_clicked", {
      channel: "linkedin",
      source: "identity",
      score,
      grade,
      missing_policies: missing,
    });
    const blob = await captureCardBlob().catch(() => null);
    const method = blob
      ? await copyOrDownloadCard(blob, filenameFor("linkedin"))
      : "failed";
    capture("audit_card_capture_completed", {
      trigger: "share_linkedin",
      status: blob ? "success" : "error",
      image_method: method,
    });
    toast(shareCardToastMessage(method));
    globalThis.open(LI_INTENT(text), "_blank", "noopener,noreferrer");
  };

  return (
    <section className="identity" data-screen-label="01 Identity">
      <div className="archetype-frame" ref={frameRef}>
        <span className="corner tl">┌ identity</span>
        <span className="corner tr">v1.0 ┐</span>
        <span className="corner bl">└ № {archetype.index} / 08</span>
        <span className="corner br">archetype ┘</span>

        <div className="arch-mast">
          <div className="arch-mast-left">
            <div className="arch-eyebrow">
              ━━ identity <span className="ix">·</span> your agent&apos;s archetype
            </div>
            <div className="arch-target">
              detected from{" "}
              <span style={{ color: "var(--ink)" }}>{toolCalls.toLocaleString()}</span>
              {" "}tool calls
              <span className="slash">/</span>
              <span style={{ color: "var(--ink)" }}>{sessions}</span>
              {" "}sessions
              <span className="slash">/</span>
              <span style={{ color: "var(--ink)" }}>{window}</span>
              <span className="live">
                <span className="dot-live"></span>live
              </span>
            </div>
          </div>
          <div className="arch-counter">
            <div>
              № {archetype.index}<span className="of"> of 08</span>
            </div>
            <div style={{ color: "var(--ink-2)", marginTop: 4 }}>archetype</div>
          </div>
        </div>

        <div className="arch-body">
          <div>
            <h1 className="arch-name">{archetype.name}</h1>
            <p className="arch-tagline">{archetype.tagline}</p>

            {secondary && (
              <div className="arch-secondary">
                <span className="with">with</span>
                <span className="name">{secondary.name.replace("the ", "")}</span>
                <span className="with">tendencies</span>
              </div>
            )}

            <div className="arch-keywords">
              {archetype.keywords.map((k, i) => (
                <React.Fragment key={k}>
                  <span className="kw">{k}</span>
                  {i < archetype.keywords.length - 1 && (
                    <span className="kw-sep">·</span>
                  )}
                </React.Fragment>
              ))}
            </div>

            <div className="arch-meta-grid">
              <div className="arch-meta-item">
                <span className="label">common in</span>
                <span className="body">{archetype.common}</span>
              </div>
              <div className="arch-meta-item">
                <span className="label p">primary risk</span>
                <span className="body">{archetype.risk}</span>
              </div>
            </div>

            <div className="arch-closing">— {archetype.closing}</div>
          </div>

          <Sigil archetypeKey={archetypeKey} />
        </div>

        <div className="identity-share-grid" aria-label="Share your audit">
          <button type="button" className="share-btn share-btn--x" onClick={handleShareX}>
            <span className="share-btn-mark share-btn-mark--x" aria-hidden="true">𝕏</span>
            <span className="share-btn-body">
              <span className="share-btn-eyebrow">share on</span>
              <span className="share-btn-label">X · Twitter</span>
            </span>
            <span className="share-btn-arrow" aria-hidden="true">→</span>
          </button>
          <button type="button" className="share-btn share-btn--li" onClick={handleShareLI}>
            <span className="share-btn-mark share-btn-mark--li" aria-hidden="true">in</span>
            <span className="share-btn-body">
              <span className="share-btn-eyebrow">share on</span>
              <span className="share-btn-label">LinkedIn</span>
            </span>
            <span className="share-btn-arrow" aria-hidden="true">→</span>
          </button>
          <button
            type="button"
            className="share-btn share-btn--dl"
            onClick={handleDownload}
            disabled={downloadState === "busy"}
          >
            <span className="share-btn-mark share-btn-mark--dl" aria-hidden="true">↓</span>
            <span className="share-btn-body">
              <span className="share-btn-eyebrow">save</span>
              <span className="share-btn-label">
                {downloadState === "busy" ? "rendering…"
                  : downloadState === "done" ? "saved ✓"
                  : downloadState === "error" ? "try again"
                  : "audit-card"}
              </span>
            </span>
            <span className="share-btn-arrow" aria-hidden="true">↓</span>
          </button>
        </div>
      </div>
    </section>
  );
});
