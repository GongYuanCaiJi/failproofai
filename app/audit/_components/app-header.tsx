"use client";

/**
 * In-page chrome for /audit. Distinct from the site-wide Navbar (which
 * is suppressed on /audit) — this one carries the failproof_ai wordmark
 * + an [ share → ] action that scrolls to / triggers the ShowOff CTA.
 *
 * Styled via `.app-header`, `.h-brand`, etc. classes from audit-styles.css.
 */
import React from "react";

interface Props {
  onShare?: () => void;
  shareLabel?: string;
}

export function AppHeader({ onShare, shareLabel = "[ share → ]" }: Props) {
  return (
    <header className="app-header">
      <a className="h-brand" href="/audit" aria-label="failproof_ai">
        <span className="h-brand-mark">▮▮</span>
        <span className="h-brand-name">failproof_ai</span>
        <span className="h-brand-sep">/</span>
        <span className="h-brand-section">audit</span>
      </a>
      <div className="h-actions">
        <button
          type="button"
          className="btn btn-primary btn-press"
          onClick={onShare}
        >
          {shareLabel}
        </button>
      </div>
    </header>
  );
}
