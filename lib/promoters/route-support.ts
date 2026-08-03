/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 25 Prisma delegates are generated during deferred validation. */
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { unprocessable } from "@/lib/api/response";
import { promoterJson, safePromoterRow } from "./api-policy";

export const operationSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/);
export const referenceSchema = z.string().regex(/^[A-Z]{2,5}-[A-Z0-9]{12,64}$/);
export const operationIdFrom = (value?: string) => value ?? `promoter:${randomUUID()}`;
export const requestHash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** Parses only known command fields; unknown fields are rejected rather than silently ignored. */
export async function parsePromoterCommand<T extends z.ZodTypeAny>(request: Request, schema: T): Promise<z.infer<T> | Response> {
  try { return (schema as any).strict().parse(await request.json()); }
  catch { return unprocessable("The promoter request is invalid."); }
}

export function isRouteResponse(value: unknown): value is Response { return value instanceof Response; }
export function safeRows(rows: Record<string, unknown>[]) { return rows.map(safePromoterRow); }
export async function ownedByReference(delegate: any, reference: string, promoterAccountId: string) {
  return delegate.findFirst({ where: { publicReference: reference, promoterAccountId }, });
}
export const db: any = prisma;
export { promoterJson };
