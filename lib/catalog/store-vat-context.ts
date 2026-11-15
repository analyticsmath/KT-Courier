import { prisma } from "@/lib/db/prisma";

export type StoreVatPricingContext = {
  marketplaceVatEnabled: boolean;
  sellerVatRegistered: boolean;
  defaultPriceIncludesTax: boolean;
  vatNote: string;
};

export async function getStoreVatPricingContext(
  storeId: string,
): Promise<StoreVatPricingContext> {
  const now = new Date();
  const db = prisma as unknown as {
    systemSetting?: { findUnique?: typeof prisma.systemSetting.findUnique };
    storeSellerLegalIdentity?: {
      findFirst?: typeof prisma.storeSellerLegalIdentity.findFirst;
    };
  };

  const [vatSetting, sellerIdentity] = await Promise.all([
    typeof db.systemSetting?.findUnique === "function"
      ? db.systemSetting.findUnique({
          where: { key: "pricing.marketplace_vat.enabled" },
          select: { value: true },
        })
      : Promise.resolve(null),
    typeof db.storeSellerLegalIdentity?.findFirst === "function"
      ? db.storeSellerLegalIdentity.findFirst({
          where: {
            storeId,
            status: "APPROVED",
            effectiveFrom: { lte: now },
            OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
          },
          orderBy: { effectiveFrom: "desc" },
          select: { vatRegistrationStatus: true },
        })
      : Promise.resolve(null),
  ]);

  const marketplaceVatEnabled = vatSetting?.value === true;
  const sellerVatRegistered =
    sellerIdentity?.vatRegistrationStatus === "REGISTERED" ||
    sellerIdentity?.vatRegistrationStatus === "VAT_REGISTERED";
  const defaultPriceIncludesTax =
    marketplaceVatEnabled && sellerVatRegistered;

  let vatNote: string;
  if (defaultPriceIncludesTax) {
    vatNote =
      "Marketplace VAT is enabled and your approved seller identity is VAT-registered. Enter ZAR selling prices inclusive of VAT.";
  } else if (!marketplaceVatEnabled && !sellerVatRegistered) {
    vatNote =
      "Marketplace VAT is currently off and your store is not VAT-registered. Enter ZAR selling prices with no VAT added.";
  } else if (!marketplaceVatEnabled) {
    vatNote =
      "Marketplace VAT is currently off. Enter ZAR selling prices with no VAT added until marketplace VAT is enabled.";
  } else {
    vatNote =
      "Your approved seller identity is not VAT-registered. Enter ZAR selling prices with no VAT added.";
  }

  return {
    marketplaceVatEnabled,
    sellerVatRegistered,
    defaultPriceIncludesTax,
    vatNote,
  };
}
