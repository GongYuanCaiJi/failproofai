/**
 * Typed wrappers around the failproofai api-server's `/v0/auth/*` endpoints.
 *
 * Uses native `fetch` (Node 20+); same shape as `src/hooks/llm-client.ts`. All
 * non-2xx responses throw `CliError` with the server's `detail` string when
 * available, so handlers can surface the message directly to the user.
 */
import { CliError } from "../cli-error";

const DEFAULT_API_BASE_URL = "https://api.befailproof.ai";

export interface UserView {
  id: string;
  email: string;
}

export interface TokenResponse {
  token_type: "Bearer";
  access_token: string;
  access_expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  user: UserView;
}

export interface AccessRefreshResponse {
  token_type: "Bearer";
  access_token: string;
  access_expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
}

export interface LoginRequestResponse {
  status: string;
  expires_in: number;
  resend_available_in: number;
}

export interface MeResponse {
  id: string;
  email: string;
  status: string;
  created_at: string;
}

interface ServerErrorBody {
  success: false;
  code: string;
  detail: string;
}

export function resolveBaseUrl(): string {
  const raw = process.env.FAILPROOFAI_API_BASE_URL?.trim();
  const url = raw && raw.length > 0 ? raw : DEFAULT_API_BASE_URL;
  return url.replace(/\/+$/, "");
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as Partial<ServerErrorBody>;
    if (body && typeof body.detail === "string" && body.detail.length > 0) {
      return body.detail;
    }
    if (body && typeof body.code === "string") return body.code;
  } catch {
    // fall through
  }
  return `${response.status} ${response.statusText}`;
}

/** Network/timeout failures: convert into a `CliError` so they land on the
 *  "Error: ..." exit-1 path instead of getting tagged "Unexpected error". The
 *  status field on the thrown error is left undefined for these so callers
 *  (whoamiCmd) can distinguish "transient" from "401, session is dead". */
function wrapFetchFailure(err: unknown, url: string): CliError {
  if (err instanceof Error && err.name === "TimeoutError") {
    return new CliError(`Request to ${url} timed out`);
  }
  const msg = err instanceof Error ? err.message : String(err);
  return new CliError(`Network error contacting ${url}: ${msg}`);
}

interface ApiError extends CliError {
  status?: number;
}

function apiErrorFromResponse(detail: string, status: number): ApiError {
  const err = new CliError(detail) as ApiError;
  err.status = status;
  return err;
}

async function postJson<T>(
  url: string,
  body: unknown,
  init?: { authToken?: string; timeoutMs?: number },
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init?.authToken) headers["Authorization"] = `Bearer ${init.authToken}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(init?.timeoutMs ?? 15_000),
    });
  } catch (err) {
    throw wrapFetchFailure(err, url);
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      const hint = retryAfter ? ` (retry after ${retryAfter}s)` : "";
      throw apiErrorFromResponse(`${detail}${hint}`, 429);
    }
    throw apiErrorFromResponse(detail, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function getJson<T>(url: string, authToken: string, timeoutMs = 15_000): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${authToken}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw wrapFetchFailure(err, url);
  }
  if (!response.ok) {
    throw apiErrorFromResponse(await readErrorDetail(response), response.status);
  }
  return (await response.json()) as T;
}

export function requestLoginCode(baseUrl: string, email: string): Promise<LoginRequestResponse> {
  return postJson<LoginRequestResponse>(`${baseUrl}/v0/auth/login/request`, { email });
}

export function verifyLoginCode(baseUrl: string, email: string, code: string): Promise<TokenResponse> {
  return postJson<TokenResponse>(`${baseUrl}/v0/auth/login/verify`, { email, code });
}

export function refreshTokens(baseUrl: string, refreshToken: string): Promise<AccessRefreshResponse> {
  return postJson<AccessRefreshResponse>(`${baseUrl}/v0/auth/token/refresh`, {
    refresh_token: refreshToken,
  });
}

export function logout(baseUrl: string, accessToken: string, refreshToken: string): Promise<void> {
  return postJson<void>(`${baseUrl}/v0/auth/logout`, { refresh_token: refreshToken }, {
    authToken: accessToken,
  });
}

export function me(baseUrl: string, accessToken: string): Promise<MeResponse> {
  return getJson<MeResponse>(`${baseUrl}/v0/auth/me`, accessToken);
}
