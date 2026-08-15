import { NextResponse, type NextRequest } from "next/server";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { CatalogPolicyError } from "@/lib/catalog/errors";
import { CatalogProductionLockedError } from "@/lib/catalog/catalog-production-lock";

export const CATALOG_JSON_BODY_LIMIT = 256 * 1024;
export const CATALOG_IMPORT_BODY_LIMIT = 5 * 1024 * 1024;
export const CATALOG_MEDIA_STREAM_LIMIT = 8 * 1024 * 1024;

export function catalogJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" },
  });
}

export function catalogApiError(error: unknown): NextResponse {
  if (error instanceof CatalogProductionLockedError) {
    return catalogJson({ error: "Catalog activation is unavailable.", code: error.code }, 423);
  }
  if (error instanceof CatalogPolicyError) {
    return catalogJson({ error: error.message, code: error.code }, error.status);
  }
  if (error && typeof error === "object" && "code" in error) {
    const code = String(error.code);
    if (code === "P2002") return catalogJson({ error: "Catalog record conflicts with existing evidence.", code: "CATALOG_CONFLICT" }, 409);
    if (code === "P2025") return catalogJson({ error: "Catalog record was not found.", code: "CATALOG_NOT_FOUND" }, 404);
  }
  return catalogJson({ error: "Catalog request could not be completed." }, 500);
}

export async function readCatalogJsonBody(
  request: NextRequest,
  limit = CATALOG_JSON_BODY_LIMIT,
): Promise<{ body: unknown } | { response: NextResponse }> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") return { response: catalogJson({ error: "Content-Type must be application/json." }, 415) };
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) {
    return { response: catalogJson({ error: "Catalog request body is too large." }, 413) };
  }
  let text: string;
  try { text = await request.text(); } catch { return { response: catalogJson({ error: "Catalog request body could not be read." }, 400) }; }
  if (Buffer.byteLength(text, "utf8") < 2 || Buffer.byteLength(text, "utf8") > limit) {
    return { response: catalogJson({ error: "Catalog request body is missing or too large." }, 413) };
  }
  try { return { body: JSON.parse(text) as unknown }; } catch { return { response: catalogJson({ error: "Catalog request body must be valid JSON." }, 400) }; }
}

export async function prepareCatalogMutation(
  request: NextRequest,
  actorId: string,
  endpoint: string,
  limit = CATALOG_JSON_BODY_LIMIT,
): Promise<{ body: unknown } | { response: NextResponse }> {
  const originFailure = await enforceSameOriginRequest(request, { path: endpoint });
  if (originFailure) return { response: originFailure };
  const rateLimit = await checkIpRateLimit(request, `${endpoint}:${actorId}`, RATE_LIMITS.CATALOG_MUTATION);
  if (!rateLimit.ok) return { response: catalogJson({ error: "Too many catalog requests." }, 429) };
  return readCatalogJsonBody(request, limit);
}

export async function readCatalogMediaStream(
  request: NextRequest,
  limit = CATALOG_MEDIA_STREAM_LIMIT,
): Promise<{ bytes: Uint8Array } | { response: NextResponse }> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/octet-stream") return { response: catalogJson({ error: "Catalog media bytes require application/octet-stream." }, 415) };
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) < 1 || Number(declared) > limit)) return { response: catalogJson({ error: "Catalog media stream is missing or too large." }, 413) };
  if (!request.body) return { response: catalogJson({ error: "Catalog media stream is required." }, 400) };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > limit) { await reader.cancel(); return { response: catalogJson({ error: "Catalog media stream is too large." }, 413) }; }
      chunks.push(result.value);
    }
  } catch {
    return { response: catalogJson({ error: "Catalog media stream could not be read." }, 400) };
  }
  if (total < 1) return { response: catalogJson({ error: "Catalog media stream is empty." }, 400) };
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return { bytes };
}

export async function prepareCatalogMediaStream(request: NextRequest, actorId: string, endpoint: string) {
  const originFailure = await enforceSameOriginRequest(request, { path: endpoint });
  if (originFailure) return { response: originFailure };
  const rateLimit = await checkIpRateLimit(request, `${endpoint}:${actorId}`, RATE_LIMITS.CATALOG_MEDIA_UPLOAD);
  if (!rateLimit.ok) return { response: catalogJson({ error: "Too many catalog media uploads." }, 429) };
  return readCatalogMediaStream(request);
}
