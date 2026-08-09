import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { badRequest, ok, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { executeRegisteredProcessor, getProcessorInventory } from "@/lib/processors/processor-service";

const executeSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    partition: z.string().trim().max(80).optional(),
    mode: z.enum(["DRY_RUN", "APPLY"]).default("DRY_RUN"),
    batchSize: z.number().int().min(1).max(2000).optional(),
    operationId: z.string().regex(/^[A-Z0-9-]{4,80}$/).optional(),
  })
  .strict();

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.PROCESSORS_READ, { request });
  if (auth.response) return auth.response;
  return ok({ data: await getProcessorInventory() });
}

export async function POST(request: NextRequest) {
  const originFailure = await enforceSameOriginRequest(request);
  if (originFailure) return originFailure;

  const auth = await requireAdminApiPermission(PERMISSIONS.PROCESSORS_READ, { request });
  if (auth.response) return auth.response;

  if (Number(request.headers.get("content-length") ?? "0") > 4_096) {
    return badRequest("Request body is too large.");
  }

  const parsed = executeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return unprocessable("Processor execution request is invalid.");
  }

  try {
    const result = await executeRegisteredProcessor({
      name: parsed.data.name,
      partition: parsed.data.partition,
      mode: parsed.data.mode,
      batchSize: parsed.data.batchSize,
      actorUserId: auth.user.id,
      operationId: parsed.data.operationId,
    });
    return ok({ data: result });
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Processor execution failed.");
  }
}
