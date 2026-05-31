/** Top navigation bar — wordmark, primary nav, refresh + reach-developers controls.
 *
 * Restyled to the audit / brutalist-pixel-craft system: the wordmark uses the
 * same pixel pink mark + Architype Stedelijk lowercase name as the audit
 * report, and each nav link is a `.tab` with a sharp pink underline on the
 * active route. No lucide icons in the bar itself — the chrome stays text-
 * forward to match the rest of the design system.
 */
"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReachDevelopers } from "@/components/reach-developers";
import { RefreshButton } from "@/app/components/refresh-button";

const NAV_LINKS = [
  { href: "/policies", label: "policies" },
  { href: "/audit", label: "audit" },
  { href: "/projects", label: "projects" },
];

export const Navbar: React.FC<{
  disabledPages?: string[];
  /** Total slipping-through actions from the latest cached audit. When > 0
   *  a small chip is rendered next to the Audit nav link. Undefined → no
   *  chip (no cache yet, or audit disabled). */
  auditSlippingCount?: number;
}> = ({ disabledPages = [], auditSlippingCount }) => {
  const pathname = usePathname();

  const sectionLabel = (() => {
    if (pathname.startsWith("/policies")) return "policies";
    if (pathname.startsWith("/audit")) return "audit";
    if (pathname.startsWith("/projects") || pathname.startsWith("/project/")) return "projects";
    return "";
  })();

  return (
    <header className="app-header">
      <a
        href="https://github.com/failproofai/failproofai"
        target="_blank"
        rel="noopener noreferrer"
        className="h-brand"
        aria-label="failproof ai · GitHub"
      >
        <span className="h-brand-mark" aria-hidden="true">▮▮</span>
        <span className="h-brand-name">failproof_ai</span>
        {process.env.NEXT_PUBLIC_APP_VERSION && (
          <span className="h-brand-sep" aria-hidden="true">·</span>
        )}
        {process.env.NEXT_PUBLIC_APP_VERSION && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--dim)",
            }}
          >
            v{process.env.NEXT_PUBLIC_APP_VERSION}
          </span>
        )}
        {sectionLabel && <span className="h-brand-sep" aria-hidden="true">·</span>}
        {sectionLabel && <span className="h-brand-section">{sectionLabel}</span>}
      </a>

      <nav className="tabs" style={{ border: "none", padding: 0, gap: 0 }}>
        {NAV_LINKS.filter(({ href }) => {
          const key = href.slice(1);
          return !disabledPages.includes(key);
        }).map(({ href, label }) => {
          const active = href === "/projects"
            ? pathname === "/projects" || pathname.startsWith("/project/")
            : pathname.startsWith(href);
          const showAuditBadge =
            href === "/audit"
            && typeof auditSlippingCount === "number"
            && auditSlippingCount > 0;
          return (
            <Link
              key={href}
              href={href}
              className={`tab${active ? " is-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span style={{ color: "var(--dim)", letterSpacing: "-2px", marginRight: 2 }}>━━</span>
              {label}
              {showAuditBadge && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: "1.4rem",
                    height: "1rem",
                    padding: "0 6px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: "0.05em",
                    background: "var(--amber-bg)",
                    color: "var(--amber)",
                    border: "1px solid var(--amber)",
                    marginLeft: 2,
                  }}
                  aria-label={`${auditSlippingCount} slipping through`}
                >
                  {auditSlippingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="h-actions">
        <RefreshButton />
        <span style={{ width: 1, height: 18, background: "var(--line)", margin: "0 6px" }} />
        <ReachDevelopers />
      </div>
    </header>
  );
};
