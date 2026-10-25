import { NextRequest, NextResponse } from "next/server";
import { completeStorePickupAddress } from "@/lib/marketplace-checkout/store-pickup-selection";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/tokens";
import { signupTransactionFailureResponse } from "@/lib/auth/signup-failure";
import { verifyStoreInvitationClaim } from "@/lib/super-admin/store-invitation";
import { ManagedCommerceError } from "@/lib/super-admin/commerce.service";
import { generateOtpCode, hashOtp, otpExpiresAt } from "@/lib/auth/otp";
import { generateSlug, generateUniqueSlug } from "@/lib/utils/slug";
import { newDriverCode } from "@/lib/utils/driver-code";
import { REGISTRATION_NOTICE } from "@/lib/auth/public-auth-messages";
import {
  CustomerSignupSchema,
  StoreSignupSchema,
  type StoreSignupInput,
  DriverSignupSchema,
  formatZodErrors,
} from "@/lib/validation/auth";
import { UserRole, OtpPurpose } from "@/types/db";
import { queueSecurityNotification } from "@/lib/notifications/security-delivery";
import { deliverSecurityEmail } from "@/lib/notifications/security-email-delivery";
import { checkAuthRateLimit, checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { tooManyRequests } from "@/lib/api/response";
import { issuePendingVerificationOtp } from "@/lib/auth/pending-verification-otp";
import {
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

  // Existing and new addresses incur the same password hashing work.
  const passwordHash = await hashPassword(data.password);
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });
  if (existing) {
    if (process.env.NODE_ENV === "production") {
      // A prior, unverified registration must not strand the user on a code screen.
      // Reuse the same recipient-scoped limiter as the explicit resend endpoint.
      // Keep the response indistinguishable for active/absent/pending accounts.
      const limiter = await checkAuthRateLimit(req, "resend-otp", data.email, RATE_LIMITS.RESEND_OTP);
      if (limiter.ok && existing.status === "PENDING_VERIFICATION") {
        const issued = await issuePendingVerificationOtp(data.email).catch(() => null);
        if (issued?.deliveryId) await deliverSecurityEmail(issued.deliveryId).catch(() => null);
      }
      return NextResponse.json({ message: REGISTRATION_NOTICE, email: data.email, deliveryPending: true }, { status: 202, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 },
    );
  }

  const role: UserRole =
    accountType === "CUSTOMER"
      ? UserRole.CUSTOMER
      : accountType === "STORE"
        ? UserRole.STORE
        : UserRole.DRIVER;

  let transactionFailure: unknown = null;
  let securityEmailQueueFailed = false;
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
        const d = data as StoreSignupInput;
        const invitation = d.inviteToken ? await tx.storeOnboardingInvitation.findUnique({where:{tokenHash:hashToken(d.inviteToken)}}) : null;
        if(d.inviteToken)verifyStoreInvitationClaim(invitation,{email:d.email,storeName:d.storeName});
        const slugKey = `store-signup:${generateSlug(d.storeName) || "store"}`;
        await tx.$queryRaw`SELECT TRUE AS locked FROM pg_advisory_xact_lock(hashtextextended(${slugKey}, 0))`;
        const storeSlug = await generateUniqueSlug(d.storeName, slug =>
          tx.store.findUnique({ where: { slug } }).then(Boolean),
        );

        await tx.storeProfile.create({
          data: {
            userId: newUser.id,
            storeName: d.storeName,
            contactPerson: d.contactPerson,
            businessPhone: data.phone ?? null,
            businessEmail: data.email,
          },
        });

        const store = await tx.store.create({
          data: {
            ownerUserId: newUser.id,
            name: d.storeName,
            slug: storeSlug,
            status: "PENDING",
            contactName: d.contactPerson,
            contactEmail: data.email,
            contactPhone: data.phone ?? null,
            addressLine1: d.businessLocation?.line1 ?? d.businessAddress?.trim() ?? null,
            addressLine2: d.businessLocation?.line2 ?? null,
            city: d.businessLocation?.city ?? null,
            province: d.businessLocation?.province ?? null,
            postalCode: d.businessLocation?.postalCode ?? null,
            country: d.businessLocation?.country ?? "South Africa",
            featured: false,
          },
        });
        if(invitation){
          const claim=await tx.storeOnboardingInvitation.updateMany({where:{id:invitation.id,status:"PENDING",expiresAt:{gt:new Date()}},data:{status:"CLAIMED",claimedByUserId:newUser.id,claimedStoreId:store.id}});
          if (claim.count !== 1) throw new ManagedCommerceError("STORE_INVITATION_INVALID", "The store invitation was already used.", 409);
        }
        if (d.businessLocation && completeStorePickupAddress(d.businessLocation)) {
          const pickup = await tx.address.create({ data: {
            ...d.businessLocation, storeId: store.id, type: "PICKUP", isDefault: true,
            label: "Default pickup", contactName: d.contactPerson, contactPhone: data.phone ?? null,
          } });
          await tx.store.update({ where: { id: store.id }, data: { defaultPickupAddressId: pickup.id } });
        }
      } else {
        const driverCode = newDriverCode();
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
        securityEmailQueueFailed = true;
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
        securityEmailQueueFailed = false;
      }

      return {
        devOtp: process.env.NODE_ENV !== "production" ? code : undefined,
        deliveryId,
      };
    })
    .catch((error: unknown) => { transactionFailure = error; return null; });

  if (!result) return signupTransactionFailureResponse(transactionFailure, { securityEmailQueueFailed });

  let deliveryPending = false;
  if (process.env.NODE_ENV === "production" && result.deliveryId) {
    const delivered = await deliverSecurityEmail(result.deliveryId).catch(
      () => null,
    );
    deliveryPending = !delivered?.accepted;
  }

  return NextResponse.json(
    {
      message: process.env.NODE_ENV === "production" ? REGISTRATION_NOTICE : deliveryPending
        ? "Account created. Verification email delivery is pending; request another code on the verification screen."
        : "Account created. Please verify your email.",
      email: data.email,
      // Accepted registration instructions stay asynchronous and reveal no
      // account-existence or provider-delivery result to an anonymous caller.
      deliveryPending: process.env.NODE_ENV === "production" ? true : deliveryPending,
      ...(process.env.NODE_ENV !== "production" && {
        _dev_otp: result.devOtp,
        _dev_note: "OTP visible in development only.",
      }),
    },
    { status: process.env.NODE_ENV === "production" || deliveryPending ? 202 : 201, headers: { "Cache-Control": "no-store" } },
  );
}
