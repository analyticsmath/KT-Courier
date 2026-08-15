import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { z } from "zod";
import { formatZodErrors } from "@/lib/validation/auth";
import {
  ok,
  unprocessable,
  tooManyRequests,
} from "@/lib/api/response";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";

const TestEmailSchema = z.object({
  recipient: z.string().email({ message: "A valid recipient email is required." }),
});

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const auth = await requireAdminApiPermission(PERMISSIONS.EMAILS_TEST, {
    request: req,
  });
  if (auth.response) return auth.response;
  const user = auth.user;

  const rl = await checkIpRateLimit(req, `admin-test-email:${user.id}`, RATE_LIMITS.ADMIN_TEST_EMAIL);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = TestEmailSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  void parsed.data.recipient;
  return ok({ delivered: false, providerReady: false, message: "Manual sending is not available. Phase 27 exposes provider readiness only." });
}
