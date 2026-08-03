import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function refundRouteSource(...segments: string[]): string {
  return readFileSync(join(process.cwd(), "app", "api", ...segments, "route.ts"), "utf8");
}

export function expectNoDeleteRoute(...segments: string[]): boolean {
  const path = join(process.cwd(), "app", "api", ...segments, "route.ts");
  return !existsSync(path) || !/export\s+async\s+function\s+DELETE\b/.test(readFileSync(path, "utf8"));
}
