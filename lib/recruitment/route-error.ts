import { NextResponse } from "next/server";
import { PermissionDeniedError } from "@/lib/auth/permissions";
import {
  RecruitmentError,
  RecruitmentIneligibilityError,
  RecruitmentPermissionDeniedError,
  RecruitmentReconciliationRequiredError,
} from "@/lib/recruitment/errors";

type RecruitmentRouteErrorStatus = 400 | 500;

/**
 * Converts known recruitment-domain failures into deliberately safe client
 * responses. Unknown failures never expose database, provider, or runtime
 * details to applicants or administrators.
 */
export function recruitmentRouteError(
  error: unknown,
  defaultStatus: RecruitmentRouteErrorStatus = 400
): NextResponse {
  if (error instanceof PermissionDeniedError || error instanceof RecruitmentPermissionDeniedError) {
    return NextResponse.json({ success: false, error: "Access denied." }, { status: 403 });
  }

  if (error instanceof RecruitmentReconciliationRequiredError) {
    return NextResponse.json({ success: false, error: error.message }, { status: 409 });
  }

  if (error instanceof RecruitmentIneligibilityError) {
    return NextResponse.json({ success: false, error: error.message }, { status: 422 });
  }

  if (error instanceof RecruitmentError) {
    return NextResponse.json({ success: false, error: error.message }, { status: defaultStatus });
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json({ success: false, error: "Invalid request data." }, { status: 400 });
  }

  return NextResponse.json(
    { success: false, error: "The recruitment request could not be completed." },
    { status: 500 }
  );
}
