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
  const who = await whoAmI();
  if (!who) {
    return NextResponse.json(
      { code: "unauthorized", message: "Sign in before setting a reminder." },
      { status: 401 },
    );
  }
  let body: SetBody = {};
  try {
    body = (await req.json().catch(() => ({}))) as SetBody;
  } catch {
    // empty body is fine — we'll fall back to the default 7-day offset
  }
  const nowSecs = Math.floor(Date.now() / 1000);
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
    return NextResponse.json(
      { code: "validation_error", message: "Reminder must be in the future." },
      { status: 400 },
    );
  }
  const reminder = {
    next_audit_at: nextAuditAt,
    user_email: who.me.email,
    set_at: nowSecs,
  };
  writeReminder(reminder);
  return NextResponse.json({ authenticated: true, reminder });
}

export async function DELETE(): Promise<NextResponse> {
  deleteReminder();
  return NextResponse.json({ ok: true });
}
