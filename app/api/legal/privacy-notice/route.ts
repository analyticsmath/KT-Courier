import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { LegalDocumentError, acknowledgePrivacyNotice, getCurrentPrivacyNotice } from "@/lib/services/legal-documents.service";

const acknowledgementSchema = z.object({ publicReference: z.string().trim().min(1).max(120).optional(), jurisdiction: z.string().trim().min(2).max(80).optional(), source: z.string().trim().min(1).max(80).default("SELF_SERVICE") }).strict();
const legalError = (error: unknown) => NextResponse.json({ error: error instanceof LegalDocumentError ? error.code : "LEGAL_DOCUMENT_REQUEST_INVALID" }, { status: error instanceof LegalDocumentError && error.code === "LEGAL_DOCUMENT_NOT_FOUND" ? 404 : 422 });

export async function GET(request: NextRequest) {
  const jurisdiction = new URL(request.url).searchParams.get("jurisdiction")?.trim() || undefined;
  const document = await getCurrentPrivacyNotice({ jurisdiction });
  return document ? NextResponse.json({ privacyNotice: document }) : NextResponse.json({ error: "LEGAL_DOCUMENT_NOT_FOUND" }, { status: 404 });
}

export async function POST(request: NextRequest) {
  const originFailure = await enforceSameOriginRequest(request, { path: new URL(request.url).pathname });
  if (originFailure) return originFailure;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  const parsed = acknowledgementSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "LEGAL_DOCUMENT_REQUEST_INVALID" }, { status: 422 });
  try { const result = await acknowledgePrivacyNotice({ userId: user.id, ...parsed.data }); return NextResponse.json({ privacyAcknowledgement: { acceptedAt: result.acceptance.acceptedAt, version: result.document } }); }
  catch (error) { return legalError(error); }
}
