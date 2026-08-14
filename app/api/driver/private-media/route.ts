import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { badRequest, created, forbidden, unauthorized, unprocessable, serviceUnavailable, tooManyRequests } from "@/lib/api/response";
import { PrivateMediaPurpose, UserRole } from "@/types/db";
import { PrivateMediaPolicyError, PrivateMediaService } from "@/lib/private-media/private-media.service";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

const driverPurposes = new Set<PrivateMediaPurpose>(["DRIVER_IDENTITY_DOCUMENT", "DRIVER_LICENCE", "DRIVER_PROFILE_PHOTO"]);
const vehiclePurposes = new Set<PrivateMediaPurpose>(["VEHICLE_REGISTRATION", "VEHICLE_LICENCE_DISC", "VEHICLE_INSURANCE", "VEHICLE_COMPLIANCE_IMAGE"]);

function failure(error: unknown) {
  if (error instanceof PrivateMediaPolicyError) {
    if (error.status === 503) return serviceUnavailable(error.message);
    if (error.status === 422 || error.status === 413) return unprocessable(error.message);
    return badRequest(error.message);
  }
  return badRequest("Private media upload could not be completed.");
}

export async function POST(request: NextRequest) {
  const originFailure = await enforceSameOriginRequest(request);
  if (originFailure) return originFailure;
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== UserRole.DRIVER) return forbidden();
  const rateLimit = checkIpRateLimit(request, `private-media-upload:${user.id}`, RATE_LIMITS.PRIVATE_MEDIA_UPLOAD);
  if (!rateLimit.ok) return tooManyRequests(rateLimit.retryAfterSeconds);
  const form = await request.formData().catch(() => null);
  if (!form) return unprocessable("A multipart form is required.");
  const purposeRaw = form.get("purpose");
  const file = form.get("file");
  const vehicleId = form.get("vehicleId");
  if (typeof purposeRaw !== "string" || !(file instanceof File) || (vehicleId !== null && typeof vehicleId !== "string")) return unprocessable("Upload fields are invalid.");
  const purpose = purposeRaw as PrivateMediaPurpose;
  if ((!vehicleId && !driverPurposes.has(purpose)) || (vehicleId && !vehiclePurposes.has(purpose))) return unprocessable("The requested private-media purpose is not allowed for this owner.");
  try {
    return created(await new PrivateMediaService().uploadForDriver({ actor: { userId: user.id, role: user.role }, purpose, vehicleId: vehicleId || undefined, fileName: file.name, mimeType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) }));
  } catch (error) { return failure(error); }
}
