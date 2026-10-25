import { NextResponse } from "next/server";
import { ManagedCommerceError } from "@/lib/super-admin/commerce.service";

/** Avoid blaming the verification email provider when registration never committed.
 * Invitation authority errors are actionable; all other transaction errors
 * remain deliberately generic to avoid leaking account, SQL or provider data. */
export function signupTransactionFailureResponse(error: unknown) {
  if (error instanceof ManagedCommerceError && error.code === "STORE_INVITATION_INVALID") {
    return NextResponse.json({
      code: "STORE_INVITATION_INVALID",
      error: "The store invitation has expired, is invalid or was already used. Ask for a new invitation link.",
    }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({
    code: "ACCOUNT_CREATION_UNAVAILABLE",
    error: "Registration could not be completed. Please try again later.",
  }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
