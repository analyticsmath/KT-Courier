import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, SESSION_COOKIE_NAME, sessionExpiresAt } from "@/lib/auth/session";
import { LoginSchema, formatZodErrors } from "@/lib/validation/auth";
import { UserStatus } from "@/types/db";
import { checkAuthRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { tooManyRequests } from "@/lib/api/response";
import { recordLoginAttempt } from "@/lib/services/login-history.service";
import {
  recordSecurityEvent,
  SECURITY_EVENT_TYPES,
} from "@/lib/services/security-events.service";
import { getPostAuthRedirect } from "@/lib/auth/role-redirects";

const GENERIC_ERROR = "Invalid email or password.";

function getEmailForAudit(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const email = (body as { email?: unknown }).email;
  return typeof email === "string" ? email : null;
}

async function recordLoginFailure(args: {
  request: Request;
  email?: string | null;
  userId?: string | null;
  failureReason: string;
}): Promise<void> {
  await recordLoginAttempt({
    userId: args.userId ?? null,
    email: args.email ?? null,
    success: false,
    failureReason: args.failureReason,
    request: args.request,
  });

  await recordSecurityEvent({
    type: SECURITY_EVENT_TYPES.LOGIN_FAILED,
    severity: "MEDIUM",
    userId: args.userId ?? null,
    message: "Login attempt failed",
    request: args.request,
    metadata: {
      email: args.email?.toLowerCase().trim() ?? null,
      failureReason: args.failureReason,
    },
  });
}

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    await recordLoginFailure({
      request: req,
      failureReason: "VALIDATION_FAILED",
    });
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    await recordLoginFailure({
      request: req,
      email: getEmailForAudit(body),
      failureReason: "VALIDATION_FAILED",
    });
    return NextResponse.json(
      { error: "Validation failed.", fields: formatZodErrors(parsed.error.issues) },
      { status: 422 }
    );
  }

  const { email, password } = parsed.data;

  const rl = checkAuthRateLimit(req, "login", email, RATE_LIMITS.LOGIN);
  if (!rl.ok) {
    await recordLoginFailure({
      request: req,
      email,
      failureReason: "RATE_LIMITED",
    });
    return tooManyRequests(rl.retryAfterSeconds);
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // Always hash-compare to prevent timing-based user enumeration
    if (!user || !user.passwordHash) {
      await new Promise((r) => setTimeout(r, 200)); // constant-time guard
      await recordLoginFailure({
        request: req,
        email,
        failureReason: "USER_NOT_FOUND",
      });
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await recordLoginFailure({
        request: req,
        email,
        userId: user.id,
        failureReason: "INVALID_PASSWORD",
      });
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.DISABLED) {
      await recordLoginFailure({
        request: req,
        email,
        userId: user.id,
        failureReason: "USER_STATUS_NOT_ALLOWED",
      });
      return NextResponse.json(
        { error: "Your account has been suspended. Please contact support." },
        { status: 403 }
      );
    }

    // Unverified users must complete OTP before accessing the dashboard
    if (user.status === UserStatus.PENDING_VERIFICATION) {
      await recordLoginFailure({
        request: req,
        email,
        userId: user.id,
        failureReason: "USER_STATUS_NOT_ALLOWED",
      });
      return NextResponse.json(
        {
          error: "Please verify your email before logging in.",
          requiresVerification: true,
          email: user.email,
        },
        { status: 403 }
      );
    }

    // Create session
    const rawToken = await createSession(user.id);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Set HTTP-only cookie
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: sessionExpiresAt(),
    });

    await recordLoginAttempt({
      userId: user.id,
      email,
      success: true,
      request: req,
    });

    await recordSecurityEvent({
      type: SECURITY_EVENT_TYPES.LOGIN_SUCCESS,
      severity: "INFO",
      userId: user.id,
      message: "User logged in successfully",
      request: req,
    });

    const redirect = getPostAuthRedirect(user.role);

    return NextResponse.json({
      message: "Logged in successfully.",
      redirect,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login failed", error);
    await recordLoginFailure({
      request: req,
      email,
      failureReason: "UNKNOWN_ERROR",
    });
    return NextResponse.json(
      { error: "Unable to log in. Please try again." },
      { status: 500 }
    );
  }
}
