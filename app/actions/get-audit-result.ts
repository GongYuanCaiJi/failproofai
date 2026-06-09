"use server";

import { readDashboardCache } from "@/src/audit/dashboard-cache";
import type { AuditResult, RunAuditOptions } from "@/src/audit/types";

export type AuditResultPayload =
  | { status: "cached"; cachedAt: string; params: RunAuditOptions; result: AuditResult }
  | { status: "empty" };

/**
 * Read the dashboard cache. Never triggers a run — `/audit` shows the empty
 * state when there's no cache and lets the user opt in to scanning. Mirrors
 * the read-only ergonomics of `getHooksConfigAction()`.
 */
export async function getAuditResultAction(): Promise<AuditResultPayload> {
  const entry = readDashboardCache();
  if (!entry) return { status: "empty" };
  return {
    status: "cached",
    cachedAt: entry.cachedAt,
    params: entry.params,
    result: entry.result,
  };
}
