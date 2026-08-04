import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ok, unauthorized, forbidden, badRequest } from "@/lib/api/response";
import { ReportReconciliationService } from "@/lib/reporting/reconciliation";
import { db } from "@/lib/db";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { z } from "zod";

const reconService = new ReportReconciliationService();
const reconciliationActionSchema = z.object({
  action: z.enum(["SCAN", "CANCEL_STUCK_JOB", "RETRY_GENERATION"]).default("SCAN"),
  dryRun: z.boolean().optional(),
  jobId: z.string().trim().min(1).optional(),
});

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
    return forbidden("Admin access required.");
  }

  const cases = await db.reportReconciliationCase.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      publicReference: true,
      reason: true,
      status: true,
      safeSummary: true,
      openedAt: true,
    },
  });

  return ok({ data: cases });
}

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
    return forbidden("Admin access required.");
  }

  const parsedBody = reconciliationActionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsedBody.success) return badRequest("Invalid reconciliation action.");
  const body = parsedBody.data;
  const action = body.action;

  try {
    if (action === "SCAN") {
      const result = await reconService.scanReconciliation(body.dryRun !== false);
      return ok({ data: result });
    }

    if (action === "CANCEL_STUCK_JOB" && body.jobId) {
      await reconService.cancelStuckJob(body.jobId);
      return ok({ message: `Cancelled stuck job ${body.jobId}` });
    }

    if (action === "RETRY_GENERATION" && body.jobId) {
      await reconService.retryGeneration(body.jobId);
      return ok({ message: `Retried generation for job ${body.jobId}` });
    }

    return badRequest(`Unknown action: ${action}`);
  } catch (error: unknown) {
    return badRequest(error instanceof Error ? error.message : "Failed to perform reconciliation action.");
  }
}
