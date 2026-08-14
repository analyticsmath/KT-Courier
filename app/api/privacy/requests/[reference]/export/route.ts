import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api/response";
import { buildPrivacyExport, getPrivacyRequest } from "@/lib/services/privacy-requests.service";
export async function GET(_request: NextRequest, { params }: { params: Promise<{ reference: string }> }) { const user = await getCurrentUser(); if (!user) return unauthorized(); try { const request = await getPrivacyRequest((await params).reference, user.id); if (!request) return notFound("Privacy request not found."); if (request.status !== "COMPLETED" || !["ACCESS", "PORTABILITY"].includes(String(request.requestType))) return badRequest("PRIVACY_EXPORT_NOT_AVAILABLE"); return ok({ data: await buildPrivacyExport(user.id) }); } catch { return notFound("Privacy request not found."); } }
