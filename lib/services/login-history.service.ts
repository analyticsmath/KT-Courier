import { prisma } from "@/lib/db/prisma";
import { getRequestMetadata } from "@/lib/security/request-metadata";

export interface RecordLoginAttemptInput {
  userId?: string | null;
  email?: string | null;
  success: boolean;
  failureReason?: string | null;
  request?: Request;
}

export async function recordLoginAttempt(
  input: RecordLoginAttemptInput
): Promise<void> {
  try {
    const metadata = input.request
      ? getRequestMetadata(input.request)
      : { ipAddress: null, userAgent: null };

    await prisma.loginHistory.create({
      data: {
        userId: input.userId ?? null,
        email: input.email?.toLowerCase().trim() || null,
        success: input.success,
        failureReason: input.failureReason ?? null,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    });
  } catch (error) {
    console.error("Failed to record login history", error);
  }
}
