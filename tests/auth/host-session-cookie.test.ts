import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getSessionCookieName,
  getSessionCookieOptions,
  setSessionCookie,
  deleteSessionCookies,
  extractSessionToken,
  HOST_SESSION_COOKIE_NAME,
  BASE_SESSION_COOKIE_NAME,
} from "../../lib/auth/session";

describe("P1R-006: __Host Session Cookie Migration & Production Security Attributes", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllEnvs();
  });

  it("1: uses base cookie name in development/test environment", () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.USE_HOST_COOKIE;

    expect(getSessionCookieName()).toBe("kt_session");
  });

  it("2: uses __Host-prefixed cookie name in production environment", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.USE_HOST_COOKIE;

    expect(getSessionCookieName()).toBe("__Host-kt_session");
  });

  it("3: enforces Secure, HttpOnly, SameSite=lax, Path=/, and NO Domain attribute in production options", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.USE_HOST_COOKIE;

    const options = getSessionCookieOptions();

    expect(options.httpOnly).toBe(true);
    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
    // Crucial for __Host- prefix RFC 6265bis compliance: MUST NOT have domain property
    expect("domain" in options).toBe(false);
    expect((options as Record<string, unknown>).domain).toBeUndefined();
    expect(options.expires).toBeInstanceOf(Date);
  });

  it("4: allows development cookie options without secure flag over localhost", () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.USE_HOST_COOKIE;

    const options = getSessionCookieOptions();

    expect(options.httpOnly).toBe(true);
    expect(options.secure).toBe(false);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  it("5: setSessionCookie sets the correct cookie name and options in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.USE_HOST_COOKIE;

    const setCalls: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
    const mockCookieStore = {
      set: (name: string, value: string, options: Record<string, unknown>) => {
        setCalls.push({ name, value, options });
      },
    };

    setSessionCookie(mockCookieStore, "test_session_token_xyz");

    expect(setCalls.length).toBe(1);
    expect(setCalls[0].name).toBe("__Host-kt_session");
    expect(setCalls[0].value).toBe("test_session_token_xyz");
    expect(setCalls[0].options.secure).toBe(true);
    expect(setCalls[0].options.httpOnly).toBe(true);
    expect(setCalls[0].options.path).toBe("/");
    expect(setCalls[0].options.domain).toBeUndefined();
  });

  it("6: deleteSessionCookies deletes both __Host and legacy session cookies for clean migration", () => {
    const deletedNames: string[] = [];
    const mockCookieStore = {
      delete: (name: string) => {
        deletedNames.push(name);
      },
    };

    deleteSessionCookies(mockCookieStore);

    expect(deletedNames).toContain(HOST_SESSION_COOKIE_NAME);
    expect(deletedNames).toContain(BASE_SESSION_COOKIE_NAME);
  });

  it("7: extractSessionToken prioritizes __Host cookie and falls back to legacy cookie", () => {
    // Both present -> __Host wins
    const storeWithBoth = {
      get: (name: string) => {
        if (name === HOST_SESSION_COOKIE_NAME) return { value: "host_token" };
        if (name === BASE_SESSION_COOKIE_NAME) return { value: "legacy_token" };
        return undefined;
      },
    };
    expect(extractSessionToken(storeWithBoth)).toBe("host_token");

    // Only legacy present -> fallback works
    const storeWithLegacyOnly = {
      get: (name: string) => {
        if (name === BASE_SESSION_COOKIE_NAME) return { value: "legacy_token" };
        return undefined;
      },
    };
    expect(extractSessionToken(storeWithLegacyOnly)).toBe("legacy_token");

    // Only __Host present -> works
    const storeWithHostOnly = {
      get: (name: string) => {
        if (name === HOST_SESSION_COOKIE_NAME) return { value: "host_token" };
        return undefined;
      },
    };
    expect(extractSessionToken(storeWithHostOnly)).toBe("host_token");

    // Neither present -> undefined
    const storeWithNone = {
      get: () => undefined,
    };
    expect(extractSessionToken(storeWithNone)).toBeUndefined();
  });
});
