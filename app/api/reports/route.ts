import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { ReportJobService } from "@/lib/reporting/services";
import { REPORT_DEFINITIONS } from "@/lib/reporting/contracts";
import { db } from "@/lib/db";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";

const jobService = new ReportJobService();

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return unauthorized();

  try {
    const jobs = await db.reportJob.findMany({
      where: { requesterUserId: session.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return ok({ data: jobs });
  } catch {
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const session = await getCurrentUser();
  if (!session) return unauthorized();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const { definitionKey, filters = {}, executionMode = "ASYNCHRONOUS_EXPORT", outputFormat = "CSV" } = body;
  if (!definitionKey || typeof definitionKey !== "string") {
    return badRequest("definitionKey is required.");
  }

  const definition = REPORT_DEFINITIONS[definitionKey];
  if (!definition) {
    return badRequest(`Unknown report definition: ${definitionKey}`);
  }

  // Build owner scope from user session
  const user = session as any;
  const ownerScope: Record<string, unknown> = { userId: user.id };
  if (user.storeId) ownerScope.storeId = user.storeId;
  if (user.driverProfileId) ownerScope.driverProfileId = user.driverProfileId;
  if (user.promoterProfileId) ownerScope.promoterId = user.promoterProfileId;

  try {
    const job = await jobService.createJob({
      definitionKey,
      requesterUserId: session.id,
      requesterRole: session.role,
      ownerScope,
      permissionSnapshot: [definition.requiredPermission],
      filters,
      executionMode,
      outputFormat,
    });

    return ok({ data: job });
  } catch (err: any) {
    return badRequest(err.message || "Failed to create report job.");
  }
}
