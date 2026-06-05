// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const trackEventMock = vi.fn();

vi.mock("@/lib/telemetry", () => ({
  trackEvent: (...args: unknown[]) => trackEventMock(...args),
}));

import {
  AuthApiError,
  requestLoginCode,
} from "@/lib/auth/api-server-client";

describe("api-server-client fetchWithTimeout telemetry", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    trackEventMock.mockClear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("fires api_server_unreachable with kind=timeout on AbortError", async () => {
    globalThis.fetch = vi.fn(async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }) as unknown as typeof fetch;

    await expect(requestLoginCode("a@b.co")).rejects.toBeInstanceOf(AuthApiError);
    expect(trackEventMock).toHaveBeenCalledWith(
      "api_server_unreachable",
      expect.objectContaining({
        kind: "timeout",
        path: "/v0/auth/login/request",
        method: "POST",
      }),
    );
  });

  it("fires api_server_unreachable with kind=network on connection error", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    await expect(requestLoginCode("a@b.co")).rejects.toBeInstanceOf(TypeError);
    expect(trackEventMock).toHaveBeenCalledWith(
      "api_server_unreachable",
      expect.objectContaining({
        kind: "network",
        path: "/v0/auth/login/request",
        method: "POST",
      }),
    );
  });

  it("does NOT fire api_server_unreachable on a successful response", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ status: "code_sent", expires_in: 600, resend_available_in: 30 }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const out = await requestLoginCode("a@b.co");
    expect(out.status).toBe("code_sent");
    expect(trackEventMock).not.toHaveBeenCalled();
  });
});
