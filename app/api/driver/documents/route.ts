import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { attachOwnDriverDocument, listOwnDriverDocuments } from "@/lib/services/driver-profile.service";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import {
  ok,
  created,
  unauthorized,
  forbidden,
  unprocessable,
  badRequest,
} from "@/lib/api/response";
import { AttachDriverDocumentSchema } from "@/lib/validation/driver";
import { formatZodErrors } from "@/lib/validation/auth";
import { UserRole } from "@/types/db";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== UserRole.DRIVER) return forbidden();

  try {
    const documents = await listOwnDriverDocuments(session.id);
    return ok(documents);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to retrieve documents.";
    return badRequest(message);
  }
}

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== UserRole.DRIVER) return forbidden();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = AttachDriverDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  try {
    const document = await attachOwnDriverDocument({
      driverUserId: session.id,
      ...parsed.data,
    });
    return created(document);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to attach document.";
    return badRequest(message);
  }
}
