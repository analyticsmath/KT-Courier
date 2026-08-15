import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { generateOtpCode, hashOtp, otpExpiresAt } from "@/lib/auth/otp";
import { generateUniqueSlug } from "@/lib/utils/slug";
import {
  CustomerSignupSchema,
  StoreSignupSchema,
  formatZodErrors,
} from "@/lib/validation/auth";
import { UserRole, OtpPurpose } from "@/types/db";
import { queueSecurityNotification } from "@/lib/notifications/security-delivery";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { tooManyRequests } from "@/lib/api/response";

const OTP_EXPIRES_MINUTES = 15;

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const rl = await checkIpRateLimit(req, "signup", RATE_LIMITS.SIGNUP);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const accountType = raw?.accountType;

  if (accountType !== "CUSTOMER" && accountType !== "STORE") {
    return NextResponse.json(
      { error: "Account type must be CUSTOMER or STORE." },
      { status: 400 }
    );
  }

  const schema = accountType === "CUSTOMER" ? CustomerSignupSchema : StoreSignupSchema;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", fields: formatZodErrors(parsed.error.issues) },
      { status: 422 }
    );
  }

  const data = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(data.password);
  const role: UserRole = accountType === "CUSTOMER" ? UserRole.CUSTOMER : UserRole.STORE;

  let storeSlug: string | undefined;
  if (accountType === "STORE") {
    const d = data as { storeName: string };
    storeSlug = await generateUniqueSlug(d.storeName, (slug) =>
      prisma.store.findUnique({ where: { slug } }).then(Boolean)
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email: data.email,
        passwordHash,
        role,
        name:
          accountType === "CUSTOMER"
            ? (data as { fullName: string }).fullName
            : (data as { contactPerson: string }).contactPerson,
        phone: data.phone ?? null,
      },
    });

    if (accountType === "CUSTOMER") {
      const d = data as { fullName: string };
      await tx.customerProfile.create({
        data: {
          userId: newUser.id,
          displayName: d.fullName,
          defaultPhone: data.phone ?? null,
        },
      });
    } else {
      const d = data as {
        storeName: string;
        contactPerson: string;
        businessAddress?: string;
      };

      await tx.storeProfile.create({
        data: {
          userId: newUser.id,
          storeName: d.storeName,
          contactPerson: d.contactPerson,
          businessPhone: data.phone ?? null,
          businessEmail: data.email,
        },
      });

      await tx.store.create({
        data: {
          ownerUserId: newUser.id,
          name: d.storeName,
          slug: storeSlug!,
          status: "PENDING",
          contactName: d.contactPerson,
          contactEmail: data.email,
          contactPhone: data.phone ?? null,
          addressLine1: d.businessAddress?.trim() || null,
          country: "South Africa",
          featured: false,
        },
      });
    }

    const code = generateOtpCode();
    const otp = await tx.otpCode.create({
      data: {
        userId: newUser.id,
        email: newUser.email,
        codeHash: hashOtp(code),
        purpose: OtpPurpose.EMAIL_VERIFICATION,
        expiresAt: otpExpiresAt(),
      },
    });

    return {
      userId: newUser.id,
      userName: newUser.name ?? "there",
      otpId: otp.id,
      devOtp: process.env.NODE_ENV !== "production" ? code : undefined,
      otpCode: code,
    };
  });

  // Phase 27 is the sole delivery authority; auth retains only code generation.
  queueSecurityNotification({ eventType: "EMAIL_VERIFICATION_OTP", operationId: `email-verification:${result.otpId}`, subjectUserId: result.userId, aggregateReference: result.userId, values: { name: result.userName, otp: result.otpCode, expiresMinutes: OTP_EXPIRES_MINUTES }, allowUnverifiedBootstrapEmail: true }).catch(() => {});

  return NextResponse.json(
    {
      message: "Account created. Please verify your email.",
      email: data.email,
      ...(process.env.NODE_ENV !== "production" && {
        _dev_otp: result.devOtp,
        _dev_note: "OTP visible in development only.",
      }),
    },
    { status: 201 }
  );
}
