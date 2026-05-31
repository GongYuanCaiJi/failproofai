/**
 * GET /api/auth/status
 *
 * Returns the currently authenticated identity, verifying the locally-stored
 * access token against the api-server's /me endpoint. Refreshes the access
 * token if it's near expiry. Never exposes the refresh token to the browser.
 *
 * Also returns the user's persisted re-audit reminder (if any). The reminder
 * lives in ~/.failproofai/next-audit.json and is only surfaced when its
 * `user_email` matches the active session — so swapping accounts via CLI
 * does not leak a previous user's reminder into the dashboard.
 */
import { NextResponse } from "next/server";
import { readReminder, whoAmI } from "@/lib/auth/auth-store";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const result = await whoAmI();
    if (!result) {
      return NextResponse.json({ authenticated: false, reminder: null }, { status: 200 });
    }
    const reminderRaw = readReminder();
    const reminder =
      reminderRaw && reminderRaw.user_email === result.me.email
        ? {
            next_audit_at: reminderRaw.next_audit_at,
            user_email: reminderRaw.user_email,
            set_at: reminderRaw.set_at,
          }
        : null;
    return NextResponse.json(
      {
        authenticated: true,
        user: {
          id: result.me.id,
          email: result.me.email,
          status: result.me.status,
          created_at: result.me.created_at,
        },
        reminder,
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { authenticated: false, reminder: null, error: message },
      { status: 200 },
    );
  }
}
