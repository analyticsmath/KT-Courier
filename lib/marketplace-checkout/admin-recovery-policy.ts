import { NextResponse, type NextRequest } from "next/server";
import { PermissionEffect } from "@/types/db";
import { prisma } from "@/lib/db/prisma";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { marketplaceJson } from "@/lib/marketplace-checkout/api-policy";

/** Shared guard for narrowly-scoped canonical recovery commands. */
export async function prepareMarketplaceAdminRecovery(request: NextRequest, input: Readonly<{ actorUserId: string; permission: string; path: string }>): Promise<{ operationId: string } | { response: NextResponse }> {
  const explicitDeny = await prisma.userPermission.findFirst({ where: { userId: input.actorUserId, effect: PermissionEffect.DENY, permission: { key: input.permission } }, select: { id: true } });
  if (explicitDeny) return { response: marketplaceJson({ error: "Administrative recovery permission denied." }, 403) };
  const origin = await enforceSameOriginRequest(request, { path: input.path });
  if (origin) return { response: origin };
  const rate = await checkIpRateLimit(request, `marketplace-recovery:${input.permission}:${input.actorUserId}`, RATE_LIMITS.MARKETPLACE_CHECKOUT_MUTATION);
  if (!rate.ok) return { response: marketplaceJson({ error: "Too many marketplace recovery requests." }, 429) };
  if (request.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase() !== "application/json") return { response: marketplaceJson({ error: "Invalid request body." }, 422) };
  let body: unknown; try { body = await request.json(); } catch { return { response: marketplaceJson({ error: "Invalid request body." }, 422) }; }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || typeof (body as { operationId?: unknown }).operationId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/.test((body as { operationId: string }).operationId)) return { response: marketplaceJson({ error: "A valid operation ID is required." }, 422) };
  return { operationId: (body as { operationId: string }).operationId };
}
