/**
 * POST /api/auth/login-verify
 *
 * Browser-facing proxy: verifies the OTP with the api-server, persists the
 * resulting tokens to ~/.failproofai/auth.json on the local dashboard host,
 * and returns *only* the user identity to the browser. The refresh token
 * never leaves the local filesystem.
 */
import { NextRequest, NextResponse } from "next/server";
import { AuthApiError, verifyLoginCode } from "@/lib/auth/api-server-client";
import { authFromTokenResponse, writeAuth } from "@/lib/auth/auth-store";
import { initTelemetry, trackEvent } from "@/lib/telemetry";
import { getInstanceId } from "@/lib/telemetry-id";

export const dynamic = "force-dynamic";

interface VerifyBody {
  email?: unknown;
  code?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: VerifyBody = {};
  try {
    body = (await req.json()) as VerifyBody;
  } catch {
    return NextResponse.json({ code: "validation_error", message: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body.email !== "string" || !body.email.trim()) {
    return NextResponse.json(
      { code: "validation_error", message: "email is required" },
      { status: 400 },
    );
  }
  if (typeof body.code !== "string" || !body.code.trim()) {
    return NextResponse.json(
      { code: "validation_error", message: "code is required" },
      { status: 400 },
    );
  }
  try {
    await initTelemetry();
  } catch {
    // best-effort telemetry: never block auth
  }
  try {
    const tokens = await verifyLoginCode(body.email, body.code);
    writeAuth(authFromTokenResponse(tokens));
    trackEvent("audit_user_identity_linked", {
      source: "audit_set_reminder_auth_dialog",
      user_id: tokens.user.id,
      local_random_id: getInstanceId(),
    });
    trackEvent("audit_otp_verified", {
      status: "success",
      source: "dashboard",
      user_id: tokens.user.id,
    });
    return NextResponse.json(
      {
        authenticated: true,
        user: { id: tokens.user.id, email: tokens.user.email },
      },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthApiError) {
      trackEvent("audit_otp_verified", {
        status: "failed",
        source: "dashboard",
        error_code: err.code,
        http_status: err.status,
      });
      return NextResponse.json(
        { code: err.code, message: err.message },
        { status: err.status },
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    trackEvent("audit_otp_verified", {
      status: "failed",
      source: "dashboard",
      error_code: "upstream_unreachable",
      error_message: message.slice(0, 200),
    });
    return NextResponse.json(
      { code: "upstream_unreachable", message: `api-server unreachable: ${message}` },
      { status: 502 },
    );
  }
}
