import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ok, unauthorized, badRequest, serverError } from "@/lib/api/response";
import { ReportJobService } from "@/lib/reporting/services";
import { db } from "@/lib/db";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { authorizeReportDefinition, getApprovedReportDefinition } from "@/lib/reporting/authorization";
import { resolveReportOwnerScope } from "@/lib/reporting/owner-scope";

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) return badRequest("Invalid report request.");
  const { definitionKey, filters = {}, executionMode = "ASYNCHRONOUS_EXPORT", outputFormat = "CSV" } = body as Record<string, unknown>;
  if (!definitionKey || typeof definitionKey !== "string") {
    return badRequest("definitionKey is required.");
  }

  try {
    const definition = getApprovedReportDefinition(definitionKey);
    await authorizeReportDefinition(session, definition, "GENERATE");
    const ownerScope = await resolveReportOwnerScope(session);
    const job = await jobService.createJob({
      definitionKey,
      requesterUserId: session.id,
      requesterRole: session.role,
      ownerScope,
      permissionSnapshot: [definition.requiredPermission],
      filters,
      executionMode: executionMode === "SYNCHRONOUS_SUMMARY" || executionMode === "ASYNCHRONOUS_REPORT" || executionMode === "ASYNCHRONOUS_EXPORT" ? executionMode : "ASYNCHRONOUS_EXPORT",
      outputFormat,
    });

    return ok({ data: job });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "statusCode" in err) {
      return Response.json({ error: "Report request could not be accepted." }, { status: Number((err as { statusCode: unknown }).statusCode) || 400 });
    }
    return serverError();
  }
}
