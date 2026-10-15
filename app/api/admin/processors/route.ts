import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { badRequest, forbidden, ok, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { executeRegisteredProcessor, getProcessorInventory } from "@/lib/processors/processor-service";
import { getRegisteredProcessor } from "@/lib/processors/processor-registry";

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

  const processor = getRegisteredProcessor(parsed.data.name);
  if (!processor) return badRequest("Processor is not registered.");
  if (!processor.manualExecutionAllowed) return forbidden("This processor only accepts internal scheduled execution.");
  // Monitoring access never grants authority to post financial or operational
  // effects. Require the selected domain's execution permission even in dry run.
  const executionAuth = await requireAdminApiPermission(processor.requiredPermission, { request });
  if (executionAuth.response) return executionAuth.response;
  if (processor.classification === "SINGLETON_MUTATING_PROCESSOR" && parsed.data.partition && parsed.data.partition !== processor.defaultPartition) {
    return badRequest("Singleton processors must use their registered partition.");
  }

  try {
    const result = await executeRegisteredProcessor({
      name: parsed.data.name,
      partition: parsed.data.partition,
      mode: parsed.data.mode,
      batchSize: parsed.data.batchSize,
      actorUserId: executionAuth.user.id,
      operationId: parsed.data.operationId,
    });
    return ok({ data: result });
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Processor execution failed.");
  }
}
