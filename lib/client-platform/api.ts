import { NextResponse, type NextRequest } from "next/server";
import { PlatformError } from "./contracts";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { readCatalogJsonBody } from "@/lib/catalog/catalog-api-policy";
export function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function failure(error: unknown) {
  if (error instanceof PlatformError)
    return json({ error: error.message, code: error.code }, error.status);
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002"
  )
    return json(
      { error: "This record conflicts with an existing operation." },
      409,
    );
  return json(
    { error: "The request could not be completed. Please try again." },
    500,
  );
}
export async function mutation(req: NextRequest, key: string) {
  const origin = await enforceSameOriginRequest(req);
  if (origin) return { response: origin };
  const rate = await checkIpRateLimit(req, key, RATE_LIMITS.ORDER_ESTIMATE);
  if (!rate.ok)
    return {
      response: json(
        { error: "Too many requests. Please retry shortly." },
        429,
      ),
    };
  return readCatalogJsonBody(req, 16 * 1024);
}
