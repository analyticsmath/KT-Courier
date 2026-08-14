import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { LegalDocumentError, acceptTerms, getCurrentTerms, getTermsStatusForUser } from "@/lib/services/legal-documents.service";

const acceptanceSchema = z.object({ publicReference: z.string().trim().min(1).max(120).optional(), jurisdiction: z.string().trim().min(2).max(80).optional(), source: z.string().trim().min(1).max(80).default("SELF_SERVICE") }).strict();
const legalError = (error: unknown) => NextResponse.json({ error: error instanceof LegalDocumentError ? error.code : "LEGAL_DOCUMENT_REQUEST_INVALID" }, { status: error instanceof LegalDocumentError && error.code === "LEGAL_DOCUMENT_NOT_FOUND" ? 404 : 422 });

export async function GET(request: NextRequest) {
  const jurisdiction = new URL(request.url).searchParams.get("jurisdiction")?.trim() || undefined;
  const current = await getCurrentTerms({ jurisdiction });
  if (!current) return NextResponse.json({ error: "LEGAL_DOCUMENT_NOT_FOUND" }, { status: 404 });
  const user = await getCurrentUser();
  return NextResponse.json({ terms: current, ...(user ? { acceptance: await getTermsStatusForUser(user.id, { jurisdiction }) } : {}) });
}

export async function POST(request: NextRequest) {
  const originFailure = await enforceSameOriginRequest(request, { path: new URL(request.url).pathname });
  if (originFailure) return originFailure;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  const parsed = acceptanceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "LEGAL_DOCUMENT_REQUEST_INVALID" }, { status: 422 });
  try { const result = await acceptTerms({ userId: user.id, ...parsed.data }); return NextResponse.json({ termsAcceptance: { acceptedAt: result.acceptance.acceptedAt, version: result.document }, acceptance: await getTermsStatusForUser(user.id, { jurisdiction: parsed.data.jurisdiction }) }); }
  catch (error) { return legalError(error); }
}
