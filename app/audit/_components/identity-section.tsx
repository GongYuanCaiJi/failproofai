"use client";

/**
 * Section 01 — IDENTITY. The hero. Big archetype name with hard-offset
 * stamp shadow, sigil to the right, keywords strip, "common in / primary
 * risk" meta grid, and the closing one-liner.
 *
 * Layout uses the ported `.archetype-frame` / `.arch-mast` / `.arch-body`
 * classes from audit-styles.css. Data sources from `src/audit/archetypes.ts`.
 *
 * Exposes a `frameRef` forwarded onto the `.archetype-frame` element so
 * the ShowOff "make poster" action can capture it via html2canvas.
 */
import React, { forwardRef } from "react";
import { ARCHETYPES, type ArchetypeKey } from "@/src/audit/archetypes";
import { Sigil } from "./sigil";

interface Props {
  archetypeKey: ArchetypeKey;
  secondaryKey: ArchetypeKey;
  toolCalls: number;
  sessions: number;
  /** "30d", "7d", etc. shown in the target line; "all time" otherwise. */
  window: string;
}

export const IdentitySection = forwardRef<HTMLDivElement, Props>(function IdentitySection(
  { archetypeKey, secondaryKey, toolCalls, sessions, window }: Props,
  frameRef,
) {
  const archetype = ARCHETYPES[archetypeKey];
  const secondary = secondaryKey !== archetypeKey ? ARCHETYPES[secondaryKey] : null;

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
      </div>
    </section>
  );
});
