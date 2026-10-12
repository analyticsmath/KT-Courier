import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { PRODUCTION_EDGE_PROJECT } from "@/lib/deployment/edge-routing";

const servers: Server[] = [];
async function listen(server: Server) {
  servers.push(server); server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); if (!address || typeof address === "string") throw new Error("Missing loopback address");
  return `http://127.0.0.1:${address.port}`;
}
afterEach(async () => { vi.unstubAllEnvs(); await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())))); });

it("actual loopback preview requests fail closed without upstream delivery, redirects or cookies", async () => {
  let upstreamHits = 0;
  const marker = "SYNTHETIC_UPSTREAM_MUST_NOT_BE_REACHED";
  const upstream = await listen(createServer((_request, response) => { upstreamHits++; response.end(marker); }));
  vi.stubEnv("VERCEL", "1"); vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("VERCEL_PROJECT_ID", PRODUCTION_EDGE_PROJECT);
  vi.stubEnv("KT_EDGE_ROLE", "production"); vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("RAILWAY_PRODUCTION_ORIGIN", upstream); vi.stubEnv("DATABASE_URL", "postgresql://synthetic:synthetic@db.invalid/production");
  const gateway = await listen(createServer(async (incoming, outgoing) => {
    const request = new NextRequest(`https://preview.synthetic.invalid${incoming.url}`, { method: incoming.method, headers: { host: incoming.headers.host ?? "" } });
    const result = proxy(request);
    // Never fetch a computed external target. Only this disposable fake is allowed.
    if (result.headers.get("x-middleware-rewrite") === upstream) {
      outgoing.end(await (await fetch(upstream)).text()); return;
    }
    outgoing.writeHead(result.status, Object.fromEntries(result.headers)); outgoing.end(await result.text());
  }));
  const requests = [["GET", "/"], ["GET", "/_next/static/chunk.js"], ["GET", "/images/brand.svg"], ["GET", "/quote"], ["GET", "/admin"], ["POST", "/api/orders"], ["POST", "/api/payments/paystack/webhook"], ["POST", "/store/orders/checkout"], ["POST", "/?server-action=synthetic"]];
  for (const [method, path] of requests) {
    const result = await fetch(`${gateway}${path}`, { method, redirect: "manual", headers: { host: "www.ktcouriers.com", "next-action": "synthetic" } });
    expect(result.status, `${method} ${path}`).toBe(503); expect(result.headers.get("cache-control")).toBe("no-store");
    for (const name of ["location", "set-cookie", "x-middleware-rewrite", "x-middleware-next"]) expect(result.headers.get(name)).toBeNull();
    expect(await result.text()).not.toContain(marker);
  }
  expect(upstreamHits).toBe(0);
});
