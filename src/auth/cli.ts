/**
 * `failproofai auth` CLI surface.
 *
 *   failproofai auth login     Email + OTP flow; writes ~/.failproofai/auth.json
 *   failproofai auth logout    Wipe auth.json (best-effort server revoke)
 *   failproofai auth whoami    Print the cached identity (or "not signed in")
 *   failproofai auth help      Usage
 *
 * Source of truth is the local cache (~/.failproofai/auth.json). Server-side
 * validation is intentionally avoided — once a token is on disk we trust it.
 * That keeps `login`, `logout`, and `whoami` consistent with each other and
 * with the dashboard, even when the api-server is unreachable.
 */

import * as readline from "node:readline";

import {
  AuthApiError,
  getApiBase,
  logoutSession,
  requestLoginCode,
  verifyLoginCode,
} from "../../lib/auth/api-server-client";
import {
  authFromTokenResponse,
  deleteAuth,
  readAuth,
  writeAuth,
} from "../../lib/auth/auth-store";
import { CliError } from "../cli-error";

interface AuthCliOptions {
  mode: "login" | "logout" | "whoami" | "help";
}

const HELP = `
failproofai auth — sign in to FailproofAI from the CLI

USAGE
  failproofai auth login         Start the email + OTP login flow
  failproofai auth logout        Remove ~/.failproofai/auth.json
  failproofai auth whoami        Print the currently signed-in identity
  failproofai auth help          Show this help (also: --help, -h)

ENVIRONMENT
  FAILPROOF_API_URL              Override the api-server base URL
                                 (default: http://localhost:8080)
  FAILPROOFAI_AUTH_DIR           Override where auth.json is stored
                                 (default: ~/.failproofai)

EXAMPLES
  failproofai auth login
  failproofai auth whoami
  failproofai auth logout
`.trimStart();

/** Deprecated `--login` / `--logout` / `--whoami` flags map back to subcommands
 *  so shell history and older docs keep working silently. */
const LEGACY_FLAG_TO_SUB: Record<string, "login" | "logout" | "whoami"> = {
  "--login": "login",
  "--logout": "logout",
  "--whoami": "whoami",
};

const SUBCOMMANDS = new Set(["login", "logout", "whoami", "help"]);

export function parseAuthArgs(args: string[]): AuthCliOptions {
  if (args.includes("--help") || args.includes("-h")) return { mode: "help" };

  const positional: string[] = [];
  const legacy: ("login" | "logout" | "whoami")[] = [];
  for (const a of args) {
    if (a === "--help" || a === "-h") continue;
    if (a in LEGACY_FLAG_TO_SUB) {
      legacy.push(LEGACY_FLAG_TO_SUB[a]);
      continue;
    }
    if (a.startsWith("-")) {
      throw new CliError(
        `Unknown flag for auth: ${a}\nRun \`failproofai auth help\` for usage.`,
      );
    }
    positional.push(a);
  }

  const subs = [...positional, ...legacy];
  if (subs.length === 0) return { mode: "help" };
  if (subs.length > 1) {
    throw new CliError(
      `Pick one of login, logout, whoami.\nRun \`failproofai auth help\` for usage.`,
    );
  }
  const sub = subs[0];
  if (!SUBCOMMANDS.has(sub)) {
    throw new CliError(
      `Unknown auth subcommand: ${sub}\nRun \`failproofai auth help\` for usage.`,
    );
  }
  return { mode: sub as AuthCliOptions["mode"] };
}

function prompt(question: string, opts: { hidden?: boolean } = {}): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  if (opts.hidden && process.stdin.isTTY) {
    const r = rl as unknown as {
      _writeToOutput: (s: string) => void;
      output: NodeJS.WritableStream;
    };
    const orig = r._writeToOutput.bind(rl);
    r._writeToOutput = (s: string): void => {
      if (s.length > 0 && s !== "\r\n" && s !== "\n") orig("*");
      else orig(s);
    };
  }
  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      rl.close();
      if (opts.hidden && process.stdin.isTTY) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

const DIM = "[2m";
const RESET = "[0m";
const PINK = "[38;5;204m";
const GREEN = "[38;5;120m";
const RED = "[38;5;197m";

function emailLooksValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function runLogin(): Promise<void> {
  const existing = readAuth();
  if (existing) {
    process.stdout.write(
      `${DIM}already signed in as${RESET} ${existing.user.email} ${DIM}(use \`failproofai auth logout\` to switch accounts)${RESET}\n`,
    );
    return;
  }

  process.stdout.write(`${PINK}━━ failproofai auth ━━${RESET}\n`);
  process.stdout.write(`${DIM}api: ${getApiBase()}${RESET}\n\n`);

  let email = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    email = await prompt("email: ");
    if (emailLooksValid(email)) break;
    process.stdout.write(`${RED}that doesn't look like an email — try again.${RESET}\n`);
    email = "";
  }
  if (!email) throw new CliError("Could not read a valid email after 3 attempts.");

  try {
    const r = await requestLoginCode(email);
    process.stdout.write(
      `\n${GREEN}code sent.${RESET} ${DIM}check ${email} — expires in ${r.expires_in}s.${RESET}\n`,
    );
  } catch (err) {
    if (err instanceof AuthApiError && err.code === "rate_limited") {
      throw new CliError(
        `Rate limited — try again in ${err.retryAfterSecs ?? "a few"} seconds.`,
      );
    }
    if (err instanceof AuthApiError) {
      throw new CliError(`Login request failed (${err.code}): ${err.message}`);
    }
    throw new CliError(
      `Could not reach the api-server at ${getApiBase()}.\n` +
        `Set FAILPROOF_API_URL or run the api-server locally on :8080.`,
    );
  }

  let tokenResp;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = await prompt("code:  ", { hidden: true });
    if (!code) continue;
    try {
      tokenResp = await verifyLoginCode(email, code);
      break;
    } catch (err) {
      if (err instanceof AuthApiError && err.status === 401) {
        process.stdout.write(`${RED}code rejected — try again.${RESET}\n`);
        continue;
      }
      if (err instanceof AuthApiError) {
        throw new CliError(`Verify failed (${err.code}): ${err.message}`);
      }
      throw new CliError(
        `Could not reach the api-server at ${getApiBase()}.`,
      );
    }
  }
  if (!tokenResp) throw new CliError("Too many bad codes — start over.");

  writeAuth(authFromTokenResponse(tokenResp));
  process.stdout.write(
    `\n${GREEN}✓ signed in as ${tokenResp.user.email}${RESET}\n` +
      `${DIM}session saved to ~/.failproofai/auth.json (mode 0600)${RESET}\n`,
  );
}

async function runLogout(): Promise<void> {
  const existing = readAuth();
  if (!existing) {
    process.stdout.write(`${DIM}not signed in. nothing to do.${RESET}\n`);
    return;
  }
  // Best-effort server revoke — failure does not block the local wipe.
  try {
    await logoutSession(existing.access_token, existing.refresh_token);
  } catch {
    // ignored — the local cache is the source of truth.
  }
  deleteAuth();
  process.stdout.write(
    `${GREEN}✓ signed out as ${existing.user.email}.${RESET}\n`,
  );
}

function runWhoami(): void {
  const existing = readAuth();
  if (!existing) {
    process.stdout.write(`${DIM}not signed in — run \`failproofai auth login\` to sign in.${RESET}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `${GREEN}✓${RESET} ${existing.user.email} ${DIM}(${existing.user.id})${RESET}\n`,
  );
}

export async function runAuthCli(args: string[]): Promise<void> {
  const opts = parseAuthArgs(args);
  if (opts.mode === "help") {
    process.stdout.write(HELP);
    return;
  }
  if (opts.mode === "login") return runLogin();
  if (opts.mode === "logout") return runLogout();
  return runWhoami();
}
