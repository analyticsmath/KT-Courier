import type { NextRequest } from "next/server";
import { createPrismaSubscriptionReviewRepository } from "@/lib/subscriptions/prisma-subscription.repository";
import { reviewSubscriptionPurchase } from "@/lib/subscriptions/subscription-review.service";
import { enforceSubscriptionMutation, exactSubscriptionKeys, readSubscriptionJson, requireSubscriptionCustomer, requiredSubscriptionString, subscriptionApiError, subscriptionJson } from "@/lib/subscriptions/api-policy";
import { getActiveCompanyProfile } from "@/lib/commercial/configuration.service";

export async function POST(request: NextRequest) {
  const limited = await enforceSubscriptionMutation(request); if (limited) return limited;
  const auth = await requireSubscriptionCustomer(request); if (auth.response) return auth.response;
  try {
    const body = await readSubscriptionJson(request); exactSubscriptionKeys(body, ["planReference"]);
    const company = await getActiveCompanyProfile();
    const supplierIdentity = company ? {
      publicReference: company.publicReference,
      versionNumber: company.versionNumber,
      legalName: company.legalName,
      tradingName: company.tradingName,
      registrationNumber: company.registrationNumber,
      vatNumber: company.vatNumber,
      physicalAddress: company.physicalAddress,
      supportEmail: company.supportEmail,
      businessEmail: company.businessEmail,
      telephoneNumbers: company.telephoneNumbers,
      website: company.website,
    } : { supplierReference: "platform-supplier-v1" };
    const review = await reviewSubscriptionPurchase(createPrismaSubscriptionReviewRepository(), { planReference: requiredSubscriptionString(body, "planReference"), subjectType: "CUSTOMER", customerUserId: auth.user.id, storeId: null, payerUserId: auth.user.id, supplierIdentity, termsVersion: "subscription-terms-v1", privacyVersion: "privacy-v1" });
    return subscriptionJson({ review }, 201);
  } catch (error) { return subscriptionApiError(error); }
}
