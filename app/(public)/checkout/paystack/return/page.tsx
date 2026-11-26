import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { MarketplacePaymentReturnStatus } from "@/components/public-v2/commerce/MarketplacePaymentReturnStatus";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import {
  MARKETPLACE_CHECKOUT_COOKIE,
  verifyMarketplaceGuestSecret,
} from "@/lib/marketplace-checkout/tokens";
import { CustomerPaymentParamsSchema } from "@/lib/validation/payments";
import { recoverPendingPaystackPaymentForPaymentId } from "@/lib/services/paystack-verify-recovery.service";

export const metadata: Metadata = {
  title: "Marketplace payment confirmation | KT Couriers",
  robots: { index: false, follow: false, nocache: true },
};

export default async function MarketplacePaystackReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string | string[]; status?: string | string[] }>;
}) {
  const query = await searchParams;
  const parsed = CustomerPaymentParamsSchema.safeParse({
    publicReference: query.payment,
  });
  if (!parsed.success) notFound();

  const payment = await prisma.payment.findUnique({
    where: { publicReference: parsed.data.publicReference },
    select: {
      id: true,
      status: true,
      subjectType: true,
      marketplaceCheckout: {
        select: {
          publicReference: true,
          status: true,
          customerUserId: true,
          guestAccessTokenHash: true,
        },
      },
    },
  });

  if (payment?.subjectType !== "MARKETPLACE_CHECKOUT" || !payment.marketplaceCheckout) {
    notFound();
  }

  const [user, cookieStore] = await Promise.all([getCurrentUser(), cookies()]);
  let checkout = payment.marketplaceCheckout;
  const guestSecret = cookieStore.get(MARKETPLACE_CHECKOUT_COOKIE)?.value;

  const authorized = checkout.customerUserId
    ? user?.id === checkout.customerUserId
    : verifyMarketplaceGuestSecret(guestSecret, checkout.guestAccessTokenHash);

  if (!authorized) notFound();

  const cancelled = query.status === "cancelled";
  if (
    !cancelled &&
    (checkout.status === "PAYMENT_PENDING" || checkout.status === "PAYMENT_PREPARING") &&
    !["SUCCEEDED", "CANCELLED", "EXPIRED", "FAILED"].includes(payment.status)
  ) {
    const recovery = await recoverPendingPaystackPaymentForPaymentId(payment.id, {
      trigger: "MARKETPLACE_PAYSTACK_RETURN",
    }).catch(() => null);
    if (
      recovery?.recovered ||
      recovery?.outcome === "APPLIED_WEBHOOK" ||
      recovery?.outcome === "SETTLED_VIA_VERIFY" ||
      recovery?.outcome === "ALREADY_SETTLED" ||
      recovery?.outcome === "FAILED_VIA_VERIFY" ||
      recovery?.outcome === "RECONCILIATION_REQUIRED"
    ) {
      const refreshed = await prisma.payment.findUnique({
        where: { id: payment.id },
        select: {
          marketplaceCheckout: {
            select: {
              publicReference: true,
              status: true,
              customerUserId: true,
              guestAccessTokenHash: true,
            },
          },
        },
      });
      if (refreshed?.marketplaceCheckout) {
        checkout = refreshed.marketplaceCheckout;
      }
    }
  }

  return (
    <MarketplacePaymentReturnStatus
      checkoutReference={checkout.publicReference}
      initialStatus={checkout.status}
      cancelled={cancelled}
    />
  );
}
