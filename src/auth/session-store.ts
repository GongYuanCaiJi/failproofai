/**
 * On-disk store for the failproofai auth session.
 *
 * Lives at `~/.failproofai/session.json`. Written with mode 0600 so other
 * users on the machine cannot read the access/refresh tokens — same pattern
 * the audit cache uses (`src/audit/cache.ts`).
 */
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SESSION_DIR = join(homedir(), ".failproofai");
const SESSION_FILE = join(SESSION_DIR, "session.json");

export interface AuthSession {
  user: { id: string; email: string };
  access_token: string;
  access_expires_at: number;
  refresh_token: string;
  refresh_expires_at: number;
  api_base_url: string;
}

export function sessionPath(): string {
  return SESSION_FILE;
}

export function readSession(): AuthSession | null {
  try {
    const raw = readFileSync(SESSION_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (
      !parsed
      || typeof parsed.access_token !== "string"
      || typeof parsed.refresh_token !== "string"
      || typeof parsed.access_expires_at !== "number"
      || typeof parsed.refresh_expires_at !== "number"
      || typeof parsed.api_base_url !== "string"
      || !parsed.user
      || typeof parsed.user.id !== "string"
      || typeof parsed.user.email !== "string"
    ) {
      return null;
    }
    return parsed as AuthSession;
  } catch {
    return null;
  }
}

export function writeSession(session: AuthSession): void {
  mkdirSync(SESSION_DIR, { recursive: true });
  writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
  try { chmodSync(SESSION_FILE, 0o600); } catch { /* best-effort on POSIX */ }
}

export function clearSession(): void {
  rmSync(SESSION_FILE, { force: true });
}
