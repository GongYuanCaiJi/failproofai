/**
 * POST /api/audit/run — kick off a `runAudit()` call and write the dashboard
 * cache on success. Returns the full `AuditResult` in the response.
 *
 * Concurrency: a module-level singleton in `_state.ts` guards against
 * overlapping runs — the second concurrent POST gets a 409. The client
 * (rerun-button.tsx) then just falls back to polling /status.
 */
import { NextRequest, NextResponse } from "next/server";
import { runAudit } from "@/src/audit";
import { writeDashboardCache } from "@/src/audit/dashboard-cache";
import { INTEGRATION_TYPES, type IntegrationType } from "@/src/hooks/types";
import type { RunAuditOptions } from "@/src/audit/types";
import { releaseRun, tryAcquireRun } from "../_state";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface RunBody {
  since?: string;
  cli?: string[];
  project?: string[];
  policy?: string[];
  noCache?: boolean;
}

const VALID_CLIS = new Set<string>(INTEGRATION_TYPES);

function sanitize(body: RunBody): RunAuditOptions {
  const opts: RunAuditOptions = {};
  if (typeof body.since === "string" && body.since.trim()) {
    opts.since = body.since.trim();
  }
  if (Array.isArray(body.cli) && body.cli.length > 0) {
    const valid = body.cli.filter((c): c is IntegrationType =>
      typeof c === "string" && VALID_CLIS.has(c)
    );
    if (valid.length > 0) opts.clis = valid;
  }
  if (Array.isArray(body.project) && body.project.length > 0) {
    opts.projects = body.project.filter((p) => typeof p === "string");
  }
  if (Array.isArray(body.policy) && body.policy.length > 0) {
    opts.policies = body.policy.filter((p) => typeof p === "string");
  }
  if (body.noCache === true) opts.noCache = true;
  return opts;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: RunBody = {};
  try {
    const raw = await request.text();
    if (raw) body = JSON.parse(raw) as RunBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const opts = sanitize(body);

  if (!tryAcquireRun()) {
    return NextResponse.json(
      { error: "Audit already running", status: "already-running" },
      { status: 409 },
    );
  }

  try {
    const result = await runAudit(opts);
    writeDashboardCache(opts, result);
    return NextResponse.json({ status: "ok", result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message, status: "error" }, { status: 500 });
  } finally {
    releaseRun();
  }
}
