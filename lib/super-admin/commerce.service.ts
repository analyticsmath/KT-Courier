import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { generateSlug, generateUniqueSlug } from "@/lib/utils/slug";
import { CatalogProductCreateSchema, StoreOfferCreateSchema, StorePriceVersionCreateSchema } from "@/lib/validation/catalog";
import { createStorePrivateCatalogProduct } from "@/lib/services/catalog-product.service";
import { createStoreCatalogOffer } from "@/lib/services/store-offer.service";
import { createStoreOfferPriceVersion } from "@/lib/services/store-price.service";

const safeText = (max: number) => z.string().trim().min(2).max(max).refine(v => !/<\/?[a-z][^>]*>/i.test(v), "HTML tags are not permitted.");
export const ManagedStoreSchema = z.object({
  name: safeText(140), ownerEmail: z.email().trim().toLowerCase().max(254), contactName: safeText(140),
  contactPhone: z.string().trim().max(30).optional(), addressLine1: z.string().trim().max(180).optional(),
  city: z.string().trim().max(100).optional(), province: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
}).strict();
export const ManagedProductSchema = CatalogProductCreateSchema.extend({ storeId: z.string().min(15).max(64), scope: z.literal("STORE_PRIVATE") }).strict();
export const ManagedOfferSchema = StoreOfferCreateSchema.extend({ storeId: z.string().min(15).max(64) }).strict();
export const ManagedPriceSchema = StorePriceVersionCreateSchema.extend({ storeId: z.string().min(15).max(64) }).strict();
export class ManagedCommerceError extends Error {
  constructor(readonly code: string, message: string, readonly status = 422) { super(message); this.name = "ManagedCommerceError"; }
}

export async function createManagedStore(actorUserId: string, input: unknown) {
  const parsed = ManagedStoreSchema.safeParse(input);
  if (!parsed.success) throw new ManagedCommerceError("STORE_INPUT_INVALID", parsed.error.issues[0]?.message ?? "Invalid store details.");
  const data = parsed.data;
  const slugKey = generateSlug(data.name) || "store";
  return prisma.$transaction(async tx => {
    // The lock serializes store creation by account and slug to prevent duplicate onboarding.
    await tx.$queryRaw`SELECT TRUE AS locked FROM pg_advisory_xact_lock(hashtextextended(${`super-admin-create-store:${data.ownerEmail}`}, 0))`;
    await tx.$queryRaw`SELECT TRUE AS locked FROM pg_advisory_xact_lock(hashtextextended(${`store-signup:${slugKey}`}, 0))`;
    const user = await tx.user.findUnique({ where: { email: data.ownerEmail }, include: { storeProfile: true } });
    if (!user || user.role !== "STORE" || user.status !== "ACTIVE" || !user.emailVerifiedAt || !user.storeProfile) {
      throw new ManagedCommerceError("STORE_OWNER_NOT_ELIGIBLE", "Use a verified active vendor account. Create and verify the vendor account before linking a store.", 409);
    }
    if (await tx.store.count({ where: { ownerUserId: user.id } })) {
      throw new ManagedCommerceError("STORE_OWNER_ALREADY_ASSIGNED", "This vendor account already owns a store. Manage the existing store instead.", 409);
    }
    const slug = await generateUniqueSlug(data.name, candidate => tx.store.findUnique({ where: { slug: candidate }, select: { id: true } }).then(Boolean));
    const created = await tx.store.create({ data: {
      ownerUserId: user.id, name: data.name, slug, status: "PENDING", featured: false,
      contactName: data.contactName, contactEmail: user.email, contactPhone: data.contactPhone || null,
      addressLine1: data.addressLine1 || null, city: data.city || null, province: data.province || null, postalCode: data.postalCode || null,
    }, select: { id: true, name: true, slug: true, status: true } });
    await tx.adminActivityLog.create({ data: { actorUserId, action: "CREATE", entityType: "Store", entityId: created.id,
      message: "Created pending store through Super Admin onboarding; separate seller approval required.", metadata: { ownerUserId: user.id, status: "PENDING" },
    } });
    return created;
  });
}

async function editableStore(storeId: string) {
  const store = await prisma.store.findFirst({ where: { id: storeId, status: { in: ["ACTIVE", "PENDING"] } }, select: { id: true } });
  if (!store) throw new ManagedCommerceError("STORE_NOT_EDITABLE", "Select an existing active or pending store; suspended and disabled stores cannot receive new drafts.", 409);
  return store;
}

export async function createManagedProduct(actorUserId: string, input: unknown) {
  const parsed = ManagedProductSchema.safeParse(input);
  if (!parsed.success) throw new ManagedCommerceError("PRODUCT_INPUT_INVALID", parsed.error.issues[0]?.message ?? "Invalid product draft.");
  const { storeId, ...draft } = parsed.data;
  await editableStore(storeId);
  return createStorePrivateCatalogProduct(storeId, actorUserId, draft);
}

export async function createManagedOffer(actorUserId: string, input: unknown) {
  const parsed = ManagedOfferSchema.safeParse(input);
  if (!parsed.success) throw new ManagedCommerceError("OFFER_INPUT_INVALID", parsed.error.issues[0]?.message ?? "Invalid store offer.");
  const { storeId, ...draft } = parsed.data;
  await editableStore(storeId);
  return createStoreCatalogOffer(storeId, actorUserId, draft);
}

export async function createManagedPrice(actorUserId: string, input: unknown) {
  const parsed = ManagedPriceSchema.safeParse(input);
  if (!parsed.success) throw new ManagedCommerceError("PRICE_INPUT_INVALID", parsed.error.issues[0]?.message ?? "Invalid price draft.");
  const { storeId, ...draft } = parsed.data;
  await editableStore(storeId);
  return createStoreOfferPriceVersion(storeId, actorUserId, draft);
}
