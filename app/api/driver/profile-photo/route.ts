import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { attachOwnProfilePhoto } from "@/lib/services/driver-profile.service";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { ok, unauthorized, forbidden, unprocessable, badRequest } from "@/lib/api/response";
import { z } from "zod";
import { formatZodErrors } from "@/lib/validation/auth";
import { UserRole } from "@/types/db";

const AttachProfilePhotoSchema = z.object({
  privateMediaReference: z.string().regex(/^PMO-[a-f0-9-]{36}$/),
});

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

  const parsed = AttachProfilePhotoSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  try {
    const updated = await attachOwnProfilePhoto({
      driverUserId: session.id,
      privateMediaReference: parsed.data.privateMediaReference,
    });
    return ok(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to attach profile photo.";
    return badRequest(message);
  }
}
