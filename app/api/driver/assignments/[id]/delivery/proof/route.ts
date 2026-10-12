import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { badRequest, created, forbidden, unauthorized, unprocessable, conflict, tooManyRequests, serviceUnavailable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { parseBoundedMultipartRequest } from "@/lib/security/bounded-upload";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { getDriverProfileIdForUser } from "@/lib/services/driver-assignments.service";
import { uploadDeliveryProof } from "@/lib/services/delivery-proof-upload.service";
import { PrivateMediaPolicyError } from "@/lib/private-media/private-media.service";
import { DriverOperationError } from "@/lib/driver-operations/errors";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const blocked = await enforceSameOriginRequest(request); if (blocked) return blocked;
  const user = await getCurrentUser(); if (!user) return unauthorized(); if (user.role !== "DRIVER") return forbidden();
  const profile = await getDriverProfileIdForUser(user.id); if (!profile) return forbidden();
  const rate = await checkIpRateLimit(request, `delivery-proof:${user.id}`, RATE_LIMITS.PRIVATE_MEDIA_UPLOAD); if (!rate.ok) return tooManyRequests(rate.retryAfterSeconds);
  const parsed = await parseBoundedMultipartRequest(request, { maxSizeBytes: 10 * 1024 * 1024, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"], maxFiles: 1 });
  if (parsed.errorResponse) return parsed.errorResponse;
  const file = parsed.result.files.file; const version = parsed.result.fields.assignmentVersion;
  if (!file || !version || !/^\d{1,9}$/.test(version) || Object.keys(parsed.result.fields).some(key => key !== "assignmentVersion")) return unprocessable("Delivery proof upload fields are invalid.");
  try {
    return created(await uploadDeliveryProof({ assignmentId: (await context.params).id, assignmentVersion: Number(version), driverProfileId: profile, actor: { userId: user.id, role: user.role }, fileName: file.sanitizedName, mimeType: file.type, bytes: file.bytes }));
  } catch (error) {
    if (error instanceof DriverOperationError) return conflict(error.message);
    if (error instanceof PrivateMediaPolicyError) return error.status === 503 ? serviceUnavailable(error.message) : unprocessable(error.message);
    return badRequest("Delivery proof upload could not be completed.");
  }
}
