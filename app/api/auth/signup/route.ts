import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { generateOtpCode, hashOtp, otpExpiresAt } from "@/lib/auth/otp";
import { generateUniqueSlug } from "@/lib/utils/slug";
import {
  CustomerSignupSchema,
  StoreSignupSchema,
  DriverSignupSchema,
  formatZodErrors,
} from "@/lib/validation/auth";
import { UserRole, OtpPurpose } from "@/types/db";
import { queueSecurityNotification } from "@/lib/notifications/security-delivery";
import { deliverSecurityEmail } from "@/lib/notifications/security-email-delivery";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { tooManyRequests } from "@/lib/api/response";
import {
  accountEmailQueueFailureResponse,
  shouldQueueSecurityEmail,
  securityEmailUnavailableResponse,
} from "@/lib/auth/security-email-readiness";

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
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const raw = body as Record<string, unknown>;
  const accountType = raw?.accountType;

  if (
    accountType !== "CUSTOMER" &&
    accountType !== "STORE" &&
    accountType !== "DRIVER"
  ) {
    return NextResponse.json(
      { error: "Account type must be CUSTOMER, STORE, or DRIVER." },
      { status: 400 },
    );
  }

  const schema =
    accountType === "CUSTOMER"
      ? CustomerSignupSchema
      : accountType === "STORE"
        ? StoreSignupSchema
        : DriverSignupSchema;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        fields: formatZodErrors(parsed.error.issues),
      },
      { status: 422 },
    );
  }

  const data = parsed.data;

  const emailUnavailable = securityEmailUnavailableResponse();
  if (emailUnavailable) return emailUnavailable;

  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(data.password);
  const role: UserRole =
    accountType === "CUSTOMER"
      ? UserRole.CUSTOMER
      : accountType === "STORE"
        ? UserRole.STORE
        : UserRole.DRIVER;

  let storeSlug: string | undefined;
  if (accountType === "STORE") {
    const d = data as { storeName: string };
    storeSlug = await generateUniqueSlug(d.storeName, (slug) =>
      prisma.store.findUnique({ where: { slug } }).then(Boolean),
    );
  }

  const result = await prisma
    .$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          role,
          name:
            accountType === "CUSTOMER" || accountType === "DRIVER"
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
      } else if (accountType === "STORE") {
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
      } else {
        const count = await tx.driverProfile.count();
        const driverCode = `DRV-${1000 + count + 1}`;
        await tx.driverProfile.create({
          data: {
            userId: newUser.id,
            driverCode,
            displayName: (data as { fullName: string }).fullName,
            phone: data.phone ?? null,
            status: "PENDING_REVIEW",
            availability: "OFFLINE",
            onboardingStatus: "PROFILE_INCOMPLETE",
            vehicleComplianceRequiredAt: new Date(),
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

      let deliveryId: string | undefined;
      if (shouldQueueSecurityEmail()) {
        const queued = await queueSecurityNotification(
          {
            eventType: "EMAIL_VERIFICATION_OTP",
            operationId: `email-verification:${otp.id}`,
            subjectUserId: newUser.id,
            aggregateReference: newUser.id,
            expiresAt: otp.expiresAt,
            values: {
              name: newUser.name ?? "there",
              otp: code,
              expiresMinutes: OTP_EXPIRES_MINUTES,
            },
            allowUnverifiedBootstrapEmail: true,
          },
          tx,
        );
        deliveryId = queued.delivery.id;
      }

      return {
        devOtp: process.env.NODE_ENV !== "production" ? code : undefined,
        deliveryId,
      };
    })
    .catch(() => null);

  if (!result) return accountEmailQueueFailureResponse();

  let deliveryPending = false;
  if (process.env.NODE_ENV === "production" && result.deliveryId) {
    const delivered = await deliverSecurityEmail(result.deliveryId).catch(
      () => null,
    );
    deliveryPending = !delivered?.accepted;
  }

  return NextResponse.json(
    {
      message: deliveryPending
        ? "Account created. Verification email delivery is pending; request another code on the verification screen."
        : "Account created. Please verify your email.",
      email: data.email,
      deliveryPending,
      ...(process.env.NODE_ENV !== "production" && {
        _dev_otp: result.devOtp,
        _dev_note: "OTP visible in development only.",
      }),
    },
    { status: deliveryPending ? 202 : 201 },
  );
}
