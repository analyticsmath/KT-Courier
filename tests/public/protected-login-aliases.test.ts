import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

afterEach(() => vi.unstubAllEnvs());

describe("protected account login aliases", () => {
  const aliases = {
    "/admin/login": "/admin",
    "/driver/login": "/driver",
    "/store/login": "/store",
    "/account/login": "/account",
    "/applicant/login": "/applicant",
  } as const;

  it.each(Object.entries(aliases))("routes unauthenticated %s to canonical sign-in and dashboard", (path, landing) => {
    vi.stubEnv("VERCEL", "");
    const response = proxy(new NextRequest(`https://www.ktcouriers.com${path}`));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!)).toEqual(new URL(`https://www.ktcouriers.com/login?returnUrl=${encodeURIComponent(landing)}`));
  });

  it.each(Object.entries(aliases))("routes authenticated %s to its real protected dashboard", (path, landing) => {
    vi.stubEnv("VERCEL", "");
    const response = proxy(new NextRequest(`https://www.ktcouriers.com${path}`, {
      headers: { cookie: "kt_session=fixture-session" },
    }));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`https://www.ktcouriers.com${landing}`);
  });

  it("does not weaken authentication for real protected driver assignments", () => {
    vi.stubEnv("VERCEL", "");
    const response = proxy(new NextRequest("https://www.ktcouriers.com/driver/assignments/assignment-one"));
    const destination = new URL(response.headers.get("location")!);
    expect(destination.pathname).toBe("/login");
    expect(destination.searchParams.get("returnUrl")).toBe("/driver/assignments/assignment-one");
  });
});
