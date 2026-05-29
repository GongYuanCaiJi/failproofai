"use client";

/**
 * Section 06 — NEXT AUDIT / "come back better." Re-audit loop CTA.
 *
 * Two actions: [ set a reminder ] (placeholder, future feature) and
 * [ install policies ] which copies the bulk install command.
 */
import React, { useState } from "react";
import type { AuditResult } from "@/src/audit/types";

interface Props {
  result: AuditResult;
}

function shortName(name: string): string {
  const slash = name.indexOf("/");
  return slash >= 0 ? name.slice(slash + 1) : name;
}

const BULK_INSTALL_CMD = "failproofai policies --install";

export function ReturnSection({ result }: Props) {
  const hasUnenabled = result.results.some(
    (r) => r.source === "builtin" && !r.enabledInConfig && r.hits > 0,
  );

  const [copied, setCopied] = useState(false);

  const handleInstall = async () => {
    try {
      await navigator.clipboard.writeText(BULK_INSTALL_CMD);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <section className="section" data-screen-label="06 Next audit">
      <div className="section-mast">
        <div className="section-label">
          <span className="glyph">━━</span> next audit{" "}
          <span style={{ color: "var(--dim)" }}>·</span> improvement
        </div>
        <div className="section-meta"><span className="g">●</span> recommended in 7d</div>
      </div>
      <h2 className="section-h">come back better.</h2>
      <div className="return-hook">
        <div className="label">━━ the loop</div>
        <h3>re-audit in 7 days.</h3>
        <p>
          after the prescribed policies have been live for a week, we&apos;ll
          show your before/after score and which detectors went quiet.
        </p>
        <p style={{ marginTop: 16, color: "var(--dim)" }}>
          most agents move from C to B in one session. some make it in a day.
        </p>
        <div className="return-actions">
          <button type="button" className="share-btn">
            [ set a reminder ]
          </button>
          {hasUnenabled && (
            <button type="button" className="share-btn alt" onClick={handleInstall}>
              {copied
                ? `[ ✓ copied — paste in your shell ]`
                : `[ install policies ]`}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
