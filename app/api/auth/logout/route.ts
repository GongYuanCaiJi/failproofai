/**
 * POST /api/auth/logout
 *
 * Reads the locally-stored session, asks the api-server to revoke it, and
 * deletes ~/.failproofai/auth.json regardless of upstream success — local
 * intent to log out takes precedence.
 */
import { NextResponse } from "next/server";
import { AuthApiError, logoutSession } from "@/lib/auth/api-server-client";
import { deleteAuth, readAuth } from "@/lib/auth/auth-store";
import { initTelemetry, trackEvent } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  await initTelemetry();
  const existing = readAuth();
  if (!existing) {
    trackEvent("audit_user_logged_out", {
      source: "dashboard",
      had_session: false,
      upstream: "noop",
    });
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
  let upstream: "revoked" | "skipped" | "failed" = "skipped";
  let upstreamError: string | null = null;
  try {
    await logoutSession(existing.access_token, existing.refresh_token);
    upstream = "revoked";
  } catch (err) {
    if (err instanceof AuthApiError && err.status === 401) {
      upstream = "revoked"; // token already invalid server-side
    } else {
      upstream = "failed";
      upstreamError = err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200);
    }
  }
  deleteAuth();
  trackEvent("audit_user_logged_out", {
    source: "dashboard",
    had_session: true,
    upstream,
    upstream_error: upstreamError,
    user_id: existing.user.id,
  });
  return NextResponse.json({ authenticated: false, upstream }, { status: 200 });
}
