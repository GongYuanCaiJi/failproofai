/**
 * Handlers behind `failproofai auth login | logout | whoami`.
 *
 * Talks to the failproofai api-server via `./api-client` and persists the
 * session via `./session-store`.
 */
import { CliError } from "../cli-error";
import { logWarn } from "../../lib/logger";
import {
  logout as apiLogout,
  me as apiMe,
  refreshTokens,
  requestLoginCode,
  resolveBaseUrl,
  verifyLoginCode,
} from "./api-client";
import { promptCode, promptEmail } from "./prompts";
import {
  type AuthSession,
  clearSession,
  readSession,
  writeSession,
} from "./session-store";

function expiresAt(seconds: number): number {
  return Date.now() + seconds * 1000;
}

export async function loginCmd(opts: { email?: string }): Promise<void> {
  const baseUrl = resolveBaseUrl();
  const email = opts.email ?? (await promptEmail());

  const requested = await requestLoginCode(baseUrl, email);
  const expiresMin = Math.max(1, Math.round(requested.expires_in / 60));
  process.stdout.write(`Sent a code to ${email} (expires in ${expiresMin}m).\n`);

  const code = await promptCode();
  const tokens = await verifyLoginCode(baseUrl, email, code);

  const session: AuthSession = {
    user: tokens.user,
    access_token: tokens.access_token,
    access_expires_at: expiresAt(tokens.access_expires_in),
    refresh_token: tokens.refresh_token,
    refresh_expires_at: expiresAt(tokens.refresh_expires_in),
    api_base_url: baseUrl,
  };
  writeSession(session);

  process.stdout.write(`Logged in as ${tokens.user.email}.\n`);
}

export async function logoutCmd(): Promise<void> {
  const session = readSession();
  if (!session) {
    process.stdout.write("Not logged in.\n");
    return;
  }

  try {
    await apiLogout(session.api_base_url, session.access_token, session.refresh_token);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logWarn(`auth: server-side logout failed, clearing local session anyway: ${msg}`);
  }

  clearSession();
  process.stdout.write("Logged out.\n");
}

export async function whoamiCmd(): Promise<void> {
  const session = readSession();
  if (!session) {
    throw new CliError("Not logged in. Run `failproofai auth login`.");
  }

  let accessToken = session.access_token;
  if (Date.now() >= session.access_expires_at) {
    if (Date.now() >= session.refresh_expires_at) {
      clearSession();
      throw new CliError("Session expired. Run `failproofai auth login`.");
    }
    try {
      const refreshed = await refreshTokens(session.api_base_url, session.refresh_token);
      const rotated: AuthSession = {
        ...session,
        access_token: refreshed.access_token,
        access_expires_at: expiresAt(refreshed.access_expires_in),
        refresh_token: refreshed.refresh_token,
        refresh_expires_at: expiresAt(refreshed.refresh_expires_in),
      };
      writeSession(rotated);
      accessToken = refreshed.access_token;
    } catch (err) {
      clearSession();
      const msg = err instanceof Error ? err.message : String(err);
      throw new CliError(`Session expired (${msg}). Run \`failproofai auth login\`.`);
    }
  }

  const profile = await apiMe(session.api_base_url, accessToken);
  process.stdout.write(`${profile.email} (id: ${profile.id}, status: ${profile.status})\n`);
}
