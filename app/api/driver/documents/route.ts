import { type NextRequest, NextResponse } from "next/server";
import { DriverDocumentError } from "@/lib/driver-documents/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { attachOwnDriverDocument, listOwnDriverDocuments } from "@/lib/services/driver-profile.service";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import {
  ok,
  created,
  unauthorized,
  forbidden,
  unprocessable,
} from "@/lib/api/response";
import { AttachDriverDocumentSchema } from "@/lib/validation/driver";
import { formatZodErrors } from "@/lib/validation/auth";
import { UserRole } from "@/types/db";

function privateResponse(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}

function documentFailure(error: unknown) {
  return privateResponse(error instanceof DriverDocumentError
    ? NextResponse.json({ code: error.code, error: error.message }, { status: error.status })
    : NextResponse.json({ error: "Driver documents are temporarily unavailable. Please try again." }, { status: 503 }));
}

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return privateResponse(unauthorized());
  if (session.role !== UserRole.DRIVER) return privateResponse(forbidden());

  try {
    const documents = await listOwnDriverDocuments(session.id);
    return privateResponse(ok(documents));
  } catch (error) {
    return documentFailure(error);
  }
}

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return privateResponse(originFailure);

  const session = await getCurrentUser();
  if (!session) return privateResponse(unauthorized());
  if (session.role !== UserRole.DRIVER) return privateResponse(forbidden());

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return privateResponse(unprocessable("Invalid request body."));
  }

  const parsed = AttachDriverDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return privateResponse(unprocessable("Validation failed.", formatZodErrors(parsed.error.issues)));
  }

  try {
    const document = await attachOwnDriverDocument({
      driverUserId: session.id,
      ...parsed.data,
    });
    return privateResponse(created(document));
  } catch (error) {
    return documentFailure(error);
  }
}
