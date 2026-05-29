// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface CapturedRequest {
  url: string;
  init: RequestInit;
}

function mockFetch(
  responder: (req: CapturedRequest) => { status?: number; body?: unknown; headers?: Record<string, string> },
) {
  const captured: CapturedRequest[] = [];
  const fetchSpy = vi.fn(async (url: string | URL, init: RequestInit = {}) => {
    const req: CapturedRequest = { url: String(url), init };
    captured.push(req);
    const { status = 200, body, headers = {} } = responder(req);
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    });
  });
  vi.stubGlobal("fetch", fetchSpy);
  return { captured };
}

describe("auth/api-client", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.FAILPROOFAI_API_BASE_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.FAILPROOFAI_API_BASE_URL;
  });

  describe("resolveBaseUrl", () => {
    it("uses the bundled default when no env override is set", async () => {
      const { resolveBaseUrl } = await import("../../src/auth/api-client");
      expect(resolveBaseUrl()).toBe("https://api.befailproof.ai");
    });

    it("respects FAILPROOFAI_API_BASE_URL and strips a trailing slash", async () => {
      process.env.FAILPROOFAI_API_BASE_URL = "http://localhost:8080/";
      const { resolveBaseUrl } = await import("../../src/auth/api-client");
      expect(resolveBaseUrl()).toBe("http://localhost:8080");
    });
  });

  describe("requestLoginCode", () => {
    it("POSTs the email and returns the parsed body", async () => {
      const { captured } = mockFetch(() => ({
        body: { status: "code_sent", expires_in: 600, resend_available_in: 30 },
      }));
      const { requestLoginCode } = await import("../../src/auth/api-client");
      const res = await requestLoginCode("http://localhost:8080", "jane@acme.com");

      expect(res).toEqual({ status: "code_sent", expires_in: 600, resend_available_in: 30 });
      expect(captured[0]?.url).toBe("http://localhost:8080/v0/auth/login/request");
      expect(captured[0]?.init.method).toBe("POST");
      expect(JSON.parse(captured[0]?.init.body as string)).toEqual({ email: "jane@acme.com" });
    });
  });

  describe("verifyLoginCode", () => {
    it("POSTs email + code and returns the token response", async () => {
      const { captured } = mockFetch(() => ({
        body: {
          token_type: "Bearer",
          access_token: "access-abc",
          access_expires_in: 3600,
          refresh_token: "refresh-xyz",
          refresh_expires_in: 2_592_000,
          user: { id: "u-1", email: "jane@acme.com" },
        },
      }));
      const { verifyLoginCode } = await import("../../src/auth/api-client");
      const res = await verifyLoginCode("http://localhost:8080", "jane@acme.com", "123456");

      expect(res.user.email).toBe("jane@acme.com");
      expect(res.access_token).toBe("access-abc");
      expect(JSON.parse(captured[0]?.init.body as string)).toEqual({
        email: "jane@acme.com",
        code: "123456",
      });
    });

    it("throws a CliError with the server detail on 401", async () => {
      mockFetch(() => ({
        status: 401,
        body: { success: false, code: "invalid_code", detail: "The code is invalid or has expired." },
      }));
      const { verifyLoginCode } = await import("../../src/auth/api-client");
      await expect(verifyLoginCode("http://x", "a@b.c", "999999"))
        .rejects.toThrow("The code is invalid or has expired.");
    });

    it("surfaces the Retry-After hint on 429", async () => {
      mockFetch(() => ({
        status: 429,
        body: { success: false, code: "rate_limited", detail: "Too many requests, please try again later." },
        headers: { "retry-after": "42" },
      }));
      const { verifyLoginCode } = await import("../../src/auth/api-client");
      await expect(verifyLoginCode("http://x", "a@b.c", "111111"))
        .rejects.toThrow(/retry after 42s/);
    });
  });

  describe("logout", () => {
    it("includes the Bearer header and the refresh token body, returns void on 204", async () => {
      const { captured } = mockFetch(() => ({ status: 204 }));
      const { logout } = await import("../../src/auth/api-client");
      await expect(logout("http://x", "access-tok", "refresh-tok")).resolves.toBeUndefined();
      expect(captured[0]?.url).toBe("http://x/v0/auth/logout");
      const headers = captured[0]?.init.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer access-tok");
      expect(JSON.parse(captured[0]?.init.body as string)).toEqual({ refresh_token: "refresh-tok" });
    });
  });

  describe("me", () => {
    it("GETs /v0/auth/me with the bearer access token", async () => {
      const { captured } = mockFetch(() => ({
        body: { id: "u-1", email: "jane@acme.com", status: "active", created_at: "2026-01-01T00:00:00Z" },
      }));
      const { me } = await import("../../src/auth/api-client");
      const res = await me("http://x", "access-tok");
      expect(res.email).toBe("jane@acme.com");
      expect(captured[0]?.url).toBe("http://x/v0/auth/me");
      expect(captured[0]?.init.method).toBe("GET");
      const headers = captured[0]?.init.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer access-tok");
    });
  });
});
