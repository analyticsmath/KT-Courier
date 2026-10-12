import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const allowedHosts = new Set(["ktcouriers.com", "www.ktcouriers.com"]);
const routes = ["/", "/api/health", "/api/ready", "/shop", "/shop/stores", "/shop/search", "/quote", "/login", "/contact", "/services/parcel"];
async function probe(input) {
  let url = new URL(input); const redirects = [];
  for (let index = 0; index < 5; index++) {
    if (url.protocol !== "https:" || !allowedHosts.has(url.hostname) || url.username || url.password) throw new Error("Public probe target refused");
    const response = await fetch(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(20_000), headers: { "user-agent": "KT-Phase3-read-only-public-probe" } });
    const record = { url: url.href, status: response.status, headers: Object.fromEntries(["content-security-policy", "strict-transport-security", "x-content-type-options", "x-frame-options", "permissions-policy", "cache-control", "x-deployment-version"].map(name => [name, response.headers.get(name)])) };
    // Public page content and cookies are deliberately neither retained nor logged.
    await response.body?.cancel();
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) { redirects.push({ url: url.href, status: response.status, location: response.headers.get("location") }); url = new URL(response.headers.get("location"), url); continue; }
    return { ...record, redirects };
  }
  throw new Error("Public redirect bound exceeded");
}
const results = await Promise.all(["https://ktcouriers.com/", ...routes.map(route => `https://www.ktcouriers.com${route}`)].map(async url => {
  try { return await probe(url); } catch { return { url, status: null, error: "READ_ONLY_PROBE_FAILED" }; }
}));
const receipt = { checkedAtUtc: new Date().toISOString(), sourceSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), scope: "PUBLIC_HTTP_LIVENESS_ONLY", requests: "GET_ONLY_NO_SESSION", protectedProductionDataAccessed: false, bodiesRetained: false, results };
mkdirSync("output/phase3", { recursive: true });
writeFileSync("output/phase3/public-route-probe.json", JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt));
if (results.some(result => result.status !== 200)) process.exitCode = 1;
