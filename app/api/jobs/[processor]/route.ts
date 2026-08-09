import crypto from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";
import { badRequest, ok, unauthorized, unprocessable } from "@/lib/api/response";
import { executeRegisteredProcessor } from "@/lib/processors/processor-service";
import { PROCESSOR_REGISTRY } from "@/lib/processors/processor-registry";

const triggerSchema = z
  .object({
    partition: z.string().trim().max(80).optional(),
    mode: z.enum(["DRY_RUN", "APPLY"]).default("APPLY"),
    batchSize: z.number().int().min(1).max(2000).optional(),
    operationId: z.string().regex(/^[A-Z0-9-]{4,80}$/).optional(),
  })
  .strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ processor: string }> },
) {
  const authHeader = request.headers.get("authorization") ?? "";
  const expectedSecret = process.env.CRON_SECRET ?? process.env.INTERNAL_JOB_SECRET;

  if (!expectedSecret || !authHeader.startsWith("Bearer ")) {
    return unauthorized();
  }

  const providedSecret = authHeader.slice(7).trim();
  const providedBuffer = Buffer.from(providedSecret);
  const expectedBuffer = Buffer.from(expectedSecret);

  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return unauthorized();
  }

  const { processor: processorName } = await params;
  if (!PROCESSOR_REGISTRY[processorName]) {
    return badRequest(`Unregistered processor '${processorName}' cannot be triggered.`);
  }

  if (Number(request.headers.get("content-length") ?? "0") > 4_096) {
    return badRequest("Request body is too large.");
  }

  const jsonBody = request.headers.get("content-type")?.includes("application/json")
    ? await request.json().catch(() => ({}))
    : {};

  const parsed = triggerSchema.safeParse(jsonBody);
  if (!parsed.success) {
    return unprocessable("Job trigger payload is invalid.");
  }

  try {
    const result = await executeRegisteredProcessor({
      name: processorName,
      partition: parsed.data.partition,
      mode: parsed.data.mode,
      batchSize: parsed.data.batchSize,
      operationId: parsed.data.operationId,
    });
    return ok({ data: result });
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Job trigger execution failed.");
  }
}
