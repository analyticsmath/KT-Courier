import { getCurrentUser } from "@/lib/auth/current-user";
import { evaluateDriverReadinessByUserId } from "@/lib/services/driver-readiness.service";
import {
  ok,
  unauthorized,
  forbidden,
  notFound,
} from "@/lib/api/response";
import { UserRole } from "@/types/db";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== UserRole.DRIVER) return forbidden();

  const evaluation = await evaluateDriverReadinessByUserId(session.id);
  if (!evaluation) return notFound("Driver profile not found.");

  return ok(evaluation);
}
