// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stdoutWrite = vi.spyOn(process.stdout, "write");

const apiClientMocks = vi.hoisted(() => ({
  resolveBaseUrl: vi.fn(),
  requestLoginCode: vi.fn(),
  verifyLoginCode: vi.fn(),
  refreshTokens: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
}));

const promptMocks = vi.hoisted(() => ({
  promptEmail: vi.fn(),
  promptCode: vi.fn(),
}));

const sessionMocks = vi.hoisted(() => ({
  readSession: vi.fn(),
  writeSession: vi.fn(),
  clearSession: vi.fn(),
}));

vi.mock("../../src/auth/api-client", () => apiClientMocks);
vi.mock("../../src/auth/prompts", () => promptMocks);
vi.mock("../../src/auth/session-store", () => sessionMocks);

describe("auth/manager", () => {
  beforeEach(() => {
    apiClientMocks.resolveBaseUrl.mockReturnValue("http://localhost:8080");
    apiClientMocks.requestLoginCode.mockReset();
    apiClientMocks.verifyLoginCode.mockReset();
    apiClientMocks.refreshTokens.mockReset();
    apiClientMocks.logout.mockReset();
    apiClientMocks.me.mockReset();
    promptMocks.promptEmail.mockReset();
    promptMocks.promptCode.mockReset();
    sessionMocks.readSession.mockReset();
    sessionMocks.writeSession.mockReset();
    sessionMocks.clearSession.mockReset();
    stdoutWrite.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("loginCmd", () => {
    it("uses --email when given, exchanges OTP for tokens, and persists the session", async () => {
      apiClientMocks.requestLoginCode.mockResolvedValue({
        status: "code_sent", expires_in: 600, resend_available_in: 30,
      });
      promptMocks.promptCode.mockResolvedValue("123456");
      apiClientMocks.verifyLoginCode.mockResolvedValue({
        token_type: "Bearer",
        access_token: "access-abc",
        access_expires_in: 3600,
        refresh_token: "refresh-xyz",
        refresh_expires_in: 2_592_000,
        user: { id: "u-1", email: "jane@acme.com" },
      });

      const { loginCmd } = await import("../../src/auth/manager");
      await loginCmd({ email: "jane@acme.com" });

      expect(promptMocks.promptEmail).not.toHaveBeenCalled();
      expect(apiClientMocks.requestLoginCode).toHaveBeenCalledWith(
        "http://localhost:8080",
        "jane@acme.com",
      );
      expect(apiClientMocks.verifyLoginCode).toHaveBeenCalledWith(
        "http://localhost:8080",
        "jane@acme.com",
        "123456",
      );
      expect(sessionMocks.writeSession).toHaveBeenCalledTimes(1);
      const written = sessionMocks.writeSession.mock.calls[0]?.[0];
      expect(written?.user.email).toBe("jane@acme.com");
      expect(written?.api_base_url).toBe("http://localhost:8080");
      expect(written?.access_expires_at).toBeGreaterThan(Date.now());
    });

    it("prompts for email when --email is omitted", async () => {
      promptMocks.promptEmail.mockResolvedValue("interactive@acme.com");
      promptMocks.promptCode.mockResolvedValue("000000");
      apiClientMocks.requestLoginCode.mockResolvedValue({
        status: "code_sent", expires_in: 600, resend_available_in: 30,
      });
      apiClientMocks.verifyLoginCode.mockResolvedValue({
        token_type: "Bearer",
        access_token: "a", access_expires_in: 10,
        refresh_token: "r", refresh_expires_in: 100,
        user: { id: "u-2", email: "interactive@acme.com" },
      });

      const { loginCmd } = await import("../../src/auth/manager");
      await loginCmd({});

      expect(promptMocks.promptEmail).toHaveBeenCalledTimes(1);
      expect(apiClientMocks.requestLoginCode).toHaveBeenCalledWith(
        "http://localhost:8080",
        "interactive@acme.com",
      );
    });
  });

  describe("logoutCmd", () => {
    it("clears the session and revokes server-side when one exists", async () => {
      sessionMocks.readSession.mockReturnValue({
        user: { id: "u", email: "a@b.c" },
        access_token: "atk",
        access_expires_at: Date.now() + 1000,
        refresh_token: "rtk",
        refresh_expires_at: Date.now() + 10000,
        api_base_url: "http://localhost:8080",
      });
      apiClientMocks.logout.mockResolvedValue(undefined);

      const { logoutCmd } = await import("../../src/auth/manager");
      await logoutCmd();

      expect(apiClientMocks.logout).toHaveBeenCalledWith("http://localhost:8080", "atk", "rtk");
      expect(sessionMocks.clearSession).toHaveBeenCalledTimes(1);
    });

    it("clears the local session even if the server call fails", async () => {
      sessionMocks.readSession.mockReturnValue({
        user: { id: "u", email: "a@b.c" },
        access_token: "atk",
        access_expires_at: Date.now() + 1000,
        refresh_token: "rtk",
        refresh_expires_at: Date.now() + 10000,
        api_base_url: "http://localhost:8080",
      });
      apiClientMocks.logout.mockRejectedValue(new Error("network down"));

      const { logoutCmd } = await import("../../src/auth/manager");
      await logoutCmd();

      expect(sessionMocks.clearSession).toHaveBeenCalledTimes(1);
    });

    it("is a no-op when there is no local session", async () => {
      sessionMocks.readSession.mockReturnValue(null);

      const { logoutCmd } = await import("../../src/auth/manager");
      await logoutCmd();

      expect(apiClientMocks.logout).not.toHaveBeenCalled();
      expect(sessionMocks.clearSession).not.toHaveBeenCalled();
    });
  });

  describe("whoamiCmd", () => {
    it("throws CliError when there is no local session", async () => {
      sessionMocks.readSession.mockReturnValue(null);
      const { whoamiCmd } = await import("../../src/auth/manager");
      await expect(whoamiCmd()).rejects.toThrow(/Not logged in/);
    });

    it("refreshes the access token when expired and re-persists the session", async () => {
      sessionMocks.readSession.mockReturnValue({
        user: { id: "u", email: "a@b.c" },
        access_token: "stale-atk",
        access_expires_at: Date.now() - 1000,
        refresh_token: "rtk-old",
        refresh_expires_at: Date.now() + 10_000,
        api_base_url: "http://localhost:8080",
      });
      apiClientMocks.refreshTokens.mockResolvedValue({
        token_type: "Bearer",
        access_token: "fresh-atk",
        access_expires_in: 3600,
        refresh_token: "rtk-new",
        refresh_expires_in: 2_592_000,
      });
      apiClientMocks.me.mockResolvedValue({
        id: "u", email: "a@b.c", status: "active", created_at: "2026-01-01T00:00:00Z",
      });

      const { whoamiCmd } = await import("../../src/auth/manager");
      await whoamiCmd();

      expect(apiClientMocks.refreshTokens).toHaveBeenCalledWith("http://localhost:8080", "rtk-old");
      expect(sessionMocks.writeSession).toHaveBeenCalledTimes(1);
      const written = sessionMocks.writeSession.mock.calls[0]?.[0];
      expect(written?.access_token).toBe("fresh-atk");
      expect(written?.refresh_token).toBe("rtk-new");
      expect(apiClientMocks.me).toHaveBeenCalledWith("http://localhost:8080", "fresh-atk");
    });

    it("clears the session and tells the user to re-login when the refresh token itself is expired", async () => {
      sessionMocks.readSession.mockReturnValue({
        user: { id: "u", email: "a@b.c" },
        access_token: "stale-atk",
        access_expires_at: Date.now() - 1000,
        refresh_token: "rtk-stale",
        refresh_expires_at: Date.now() - 1,
        api_base_url: "http://localhost:8080",
      });

      const { whoamiCmd } = await import("../../src/auth/manager");
      await expect(whoamiCmd()).rejects.toThrow(/Session expired/);
      expect(sessionMocks.clearSession).toHaveBeenCalledTimes(1);
      expect(apiClientMocks.refreshTokens).not.toHaveBeenCalled();
    });
  });
});
