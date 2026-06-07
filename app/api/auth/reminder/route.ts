/**
 * /api/auth/reminder
 *
 * GET    — current reminder state (if any, scoped to the signed-in user)
 * POST   — set or update the next-audit reminder; requires an active session
 * DELETE — clear the reminder
 *
 * Reminder timestamp lives in ~/.failproofai/next-audit.json. The dashboard
 * AND the CLI can read it later (we just persist intent here; the actual
 * email send is wired separately when the scheduler is built).
 */
import { NextRequest, NextResponse } from "next/server";
import {
  deleteReminder,
  readReminder,
  whoAmI,
  writeReminder,
} from "@/lib/auth/auth-store";
import {
  AuthApiError,
  cancelReminder,
  scheduleReminder,
} from "@/lib/auth/api-server-client";
import { initTelemetry, trackEvent } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

const DEFAULT_OFFSET_DAYS = 7;
const MAX_OFFSET_DAYS = 365;

export async function GET(): Promise<NextResponse> {
  const who = await whoAmI();
  const reminder = readReminder();
  if (!reminder) {
    return NextResponse.json({ authenticated: !!who, reminder: null });
  }
  // If the reminder belongs to a different user (or no one is signed in),
  // surface it as null so the UI doesn't show "next audit set for alice"
  // when bob is the current session.
  if (!who || who.me.email !== reminder.user_email) {
    return NextResponse.json({ authenticated: !!who, reminder: null });
  }
  return NextResponse.json({
    authenticated: true,
    reminder: {
      next_audit_at: reminder.next_audit_at,
      user_email: reminder.user_email,
      set_at: reminder.set_at,
    },
  });
}

interface SetBody {
  /** Days from now until the reminder fires. Default: 7. */
  in_days?: unknown;
  /** Absolute unix-seconds timestamp. Wins over in_days when both are sent. */
  at?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  await initTelemetry();
  const who = await whoAmI();
  if (!who) {
    trackEvent("audit_reminder_set", { status: "unauthorized", source: "dashboard" });
    return NextResponse.json(
      { code: "unauthorized", message: "Sign in before setting a reminder." },
      { status: 401 },
    );
  }
  let body: SetBody = {};
  // Distinguish three cases:
  //   1. empty body          → defaults (7d from now)
  //   2. malformed JSON      → 400 Bad Request (don't silently swap to {})
  //   3. valid JSON, not obj → 400 Bad Request (arrays/primitives are not SetBody)
  const raw = await req.text();
  if (raw.trim().length > 0) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      trackEvent("audit_reminder_set", {
        status: "validation_error",
        source: "dashboard",
        reason: "malformed_json",
        user_id: who.me.id,
      });
      return NextResponse.json(
        { code: "validation_error", message: "Request body is not valid JSON." },
        { status: 400 },
      );
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      trackEvent("audit_reminder_set", {
        status: "validation_error",
        source: "dashboard",
        reason: "not_an_object",
        user_id: who.me.id,
      });
      return NextResponse.json(
        { code: "validation_error", message: "Request body must be a JSON object." },
        { status: 400 },
      );
    }
    body = parsed as SetBody;
  }
  const nowSecs = Math.floor(Date.now() / 1000);
  const maxAt = nowSecs + MAX_OFFSET_DAYS * 86400;
  let nextAuditAt: number;
  if (typeof body.at === "number" && Number.isFinite(body.at)) {
    nextAuditAt = Math.floor(body.at);
  } else {
    const offsetDays =
      typeof body.in_days === "number" && Number.isFinite(body.in_days)
        ? Math.max(1, Math.min(MAX_OFFSET_DAYS, Math.floor(body.in_days)))
        : DEFAULT_OFFSET_DAYS;
    nextAuditAt = nowSecs + offsetDays * 86400;
  }
  if (nextAuditAt <= nowSecs) {
    trackEvent("audit_reminder_set", {
      status: "validation_error",
      source: "dashboard",
      reason: "in_the_past",
      user_id: who.me.id,
    });
    return NextResponse.json(
      { code: "validation_error", message: "Reminder must be in the future." },
      { status: 400 },
    );
  }
  // Upper-bound guard: catches the common foot-gun where a caller passes
  // `Date.now()` (ms) instead of unix-seconds — would otherwise persist a
  // year-55000 reminder, render "in 19000000 days", and send nonsense
  // fire_at to the upstream scheduler.
  if (nextAuditAt > maxAt) {
    trackEvent("audit_reminder_set", {
      status: "validation_error",
      source: "dashboard",
      reason: "too_far_in_future",
      user_id: who.me.id,
    });
    return NextResponse.json(
      {
        code: "validation_error",
        message: `Reminder must be within ${MAX_OFFSET_DAYS} days. Did you pass milliseconds instead of seconds?`,
      },
      { status: 400 },
    );
  }
  const reminder = {
    next_audit_at: nextAuditAt,
    user_email: who.me.email,
    set_at: nowSecs,
  };
  writeReminder(reminder);
  // Forward to the api-server scheduler so it can deliver via SES. The local
  // file is the dashboard/CLI source-of-truth; the api-server holds the
  // delivery slot. We tolerate upstream failure — the local write already
  // succeeded and the user gets a usable response.
  let upstream: "scheduled" | "failed" | "skipped" = "skipped";
  let upstreamError: string | null = null;
  try {
    await scheduleReminder(who.auth.access_token, { at: nextAuditAt });
    upstream = "scheduled";
  } catch (err) {
    upstream = "failed";
    upstreamError =
      err instanceof AuthApiError
        ? `${err.code}: ${err.message}`.slice(0, 200)
        : err instanceof Error
          ? err.message.slice(0, 200)
          : String(err).slice(0, 200);
  }
  trackEvent("audit_reminder_set", {
    status: "success",
    source: "dashboard",
    user_id: who.me.id,
    offset_days: Math.round((nextAuditAt - nowSecs) / 86400),
    upstream,
    upstream_error: upstreamError,
  });
  return NextResponse.json({ authenticated: true, reminder });
}

export async function DELETE(): Promise<NextResponse> {
  await initTelemetry();
  const who = await whoAmI();
  const existing = readReminder();
  deleteReminder();
  let upstream: "cancelled" | "failed" | "skipped" = "skipped";
  let upstreamError: string | null = null;
  if (who) {
    try {
      await cancelReminder(who.auth.access_token);
      upstream = "cancelled";
    } catch (err) {
      upstream = "failed";
      upstreamError =
        err instanceof AuthApiError
          ? `${err.code}: ${err.message}`.slice(0, 200)
          : err instanceof Error
            ? err.message.slice(0, 200)
            : String(err).slice(0, 200);
    }
  }
  trackEvent("audit_reminder_cleared", {
    source: "dashboard",
    had_local_reminder: existing !== null,
    user_id: who?.me.id ?? null,
    upstream,
    upstream_error: upstreamError,
  });
  return NextResponse.json({ ok: true });
}
