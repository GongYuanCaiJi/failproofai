"use client";

/**
 * Section 02 — STRENGTHS. "your agent does this right." A leaderboard
 * of green-checked behaviors derived from the AuditResult (see
 * `src/audit/strengths.ts`).
 */
import React from "react";
import type { Strength } from "@/src/audit/strengths";

interface Props {
  strengths: Strength[];
  totalDetectorsTriggered: number;
  totalDetectorsAvailable: number;
}

export function StrengthsSection({
  strengths, totalDetectorsTriggered, totalDetectorsAvailable,
}: Props) {
  if (strengths.length === 0) return null;

  return (
    <section className="section" data-screen-label="02 Strengths">
      <div className="section-mast">
        <div className="section-label">
          <span className="glyph">━━</span> strengths
          {" "}<span style={{ color: "var(--dim)" }}>·</span>{" "}
          what your agent has figured out
        </div>
        <div className="section-meta">
          <span className="g">●</span>{" "}
          {totalDetectorsAvailable - totalDetectorsTriggered} of {totalDetectorsAvailable} clean
        </div>
      </div>
      <h2 className="section-h">your agent does this right.</h2>

      <div className="strengths-grid">
        {strengths.map((s, i) => (
          <div key={i} className="strength-row">
            <div className="strength-check">✓</div>
            <div className="strength-body">
              <div className="strength-headline">{s.headline}</div>
              <div className="strength-detail">{s.detail}</div>
            </div>
            <div className="strength-metric">
              {s.metric}
              <span className="unit">{s.unit}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="strengths-footer">
        — these are your agent&apos;s defaults. keep them.
      </div>
    </section>
  );
}
