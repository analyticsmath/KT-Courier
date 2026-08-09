import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { PermissionDeniedError } from "@/lib/auth/permissions";

type ErrorEnvelope = "plain" | "success";

type ApiRouteErrorOptions = {
  fallbackMessage: string;
  domainErrorStatus?: number;
  envelope?: ErrorEnvelope;
};

type CodedDomainError = Error & { code: string };

const safeDomainCodePrefixes = [
  "ADVERTISING_",
  "CATALOG_",
  "COMMISSION_",
  "MARKETPLACE_",
  "PAYMENT_",
  "PROMOTION_",
  "REFUND_",
  "REPORT_",
  "STORE_",
] as const;

function hasOwnStringCode(error: Error): error is CodedDomainError {
  return typeof Object.getOwnPropertyDescriptor(error, "code")?.value === "string";
}

function isCodedDomainError(error: unknown): error is CodedDomainError {
  return error instanceof Error && hasOwnStringCode(error)
    && safeDomainCodePrefixes.some((prefix) => error.code.startsWith(prefix));
}

function response(message: string, status: number, envelope: ErrorEnvelope): NextResponse {
  return NextResponse.json(envelope === "success" ? { success: false, error: message } : { error: message }, { status });
}

function domainStatus(error: CodedDomainError, fallbackStatus: number): number {
  if (/_NOT_FOUND$/.test(error.code)) return 404;
  if (/(?:_FORBIDDEN|_DENIED)$/.test(error.code)) return 403;
  if (/(?:_CONFLICT|_ALREADY_|_REPLAY|_IN_PROGRESS)/.test(error.code)) return 409;
  if (/_RATE_LIMIT/.test(error.code)) return 429;
  if (/(?:_INVALID|_VALIDATION)/.test(error.code)) return 422;
  return fallbackStatus;
}

/** Maps only validated public domain errors; unknown runtime failures remain opaque. */
export function apiRouteError(error: unknown, options: ApiRouteErrorOptions): NextResponse {
  const envelope = options.envelope ?? "plain";
  if (error instanceof PermissionDeniedError) {
    return response("You do not have permission to perform this action.", 403, envelope);
  }
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return response("Invalid request data.", 422, envelope);
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") return response("Resource not found.", 404, envelope);
    if (error.code === "P2002") return response("A conflicting resource already exists.", 409, envelope);
    if (error.code === "P2034") return response("The request conflicted with another update. Please try again.", 409, envelope);
  }
  if (isCodedDomainError(error)) {
    return response(error.message, domainStatus(error, options.domainErrorStatus ?? 400), envelope);
  }
  return response(options.fallbackMessage, 500, envelope);
}
