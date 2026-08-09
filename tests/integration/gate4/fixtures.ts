import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient, Prisma } from "@prisma/client";

export const gate4Prisma = new PrismaClient();

export class Gate4FixtureError extends Error {
  code = "GATE4_FIXTURE_SETUP_FAILURE";
  constructor(message: string) {
    super(`[GATE4_FIXTURE_SETUP_FAILURE] ${message}`);
    this.name = "Gate4FixtureError";
  }
}

export interface Gate4OperationContext {
  rootScenario?: string;
  builderStack?: string[];
  currentBuilder?: string;
  scenario?: string;
  builder?: string;
  model?: string;
  operation?: string;
  lifecycle?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<Gate4OperationContext>();

export async function withGate4FixtureOperation<T>(
  meta: Gate4OperationContext,
  fn: () => Promise<T>
): Promise<T> {
  const parentStore = asyncLocalStorage.getStore();
  const rootScenario = parentStore?.rootScenario || meta.rootScenario || meta.scenario || "Unknown Scenario";
  const parentStack = parentStore?.builderStack || [];
  const currentBuilder = meta.currentBuilder || meta.builder || parentStore?.currentBuilder || "Unknown Builder";
  const builderStack = (meta.builder || meta.currentBuilder)
    ? [...parentStack, (meta.builder || meta.currentBuilder)!]
    : (parentStack.length > 0 ? parentStack : [currentBuilder]);

  const newStore: Gate4OperationContext = {
    rootScenario,
    builderStack,
    currentBuilder,
    model: meta.model || parentStore?.model,
    operation: meta.operation || parentStore?.operation,
    lifecycle: meta.lifecycle || parentStore?.lifecycle,
    scenario: rootScenario,
    builder: currentBuilder,
  };

  return asyncLocalStorage.run(newStore, async () => {
    try {
      return await fn();
    } catch (err: unknown) {
      if (err && typeof err === "object") {
        const existingMeta = (err as Record<string, unknown>).gate4OperationContext;
        if (!existingMeta) {
          (err as Record<string, unknown>).gate4OperationContext = {
            rootScenario: newStore.rootScenario,
            builderStack: newStore.builderStack,
            currentBuilder: newStore.currentBuilder,
            model: meta.model || newStore.model || "N/A",
            operation: meta.operation || newStore.operation || "N/A",
            scenario: newStore.rootScenario,
            builder: newStore.currentBuilder,
          };
        }
      }
      throw err;
    }
  });
}

export function getCurrentGate4OperationContext(): Gate4OperationContext | null {
  return asyncLocalStorage.getStore() || null;
}

export function requireGate4Fixture<T>(
  value: T | null | undefined,
  message: string
): T {
  if (value == null) {
    throw new Gate4FixtureError(message);
  }
  return value;
}

export function gate4Tag(suite: string, test: string): string {
  const cleanSuite = suite.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 10);
  const cleanTest = test.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 10);
  return `gate4-${cleanSuite}-${cleanTest}-${randomUUID().slice(0, 8)}`;
}

export async function createGate4User(
  suite: string,
  test: string,
  role: "CUSTOMER" | "STORE" | "DRIVER" | "ADMIN" = "CUSTOMER",
  status: "ACTIVE" | "PENDING_VERIFICATION" | "SUSPENDED" = "ACTIVE"
) {
  const tag = gate4Tag(suite, test);
  const user = await gate4Prisma.user.create({
    data: {
      email: `${tag}@gate4.test`,
      name: `Gate 4 ${role} ${tag}`,
      role,
      status,
      passwordHash: "not-used-in-gate4-tests",
      emailVerifiedAt: new Date(),
    },
  });

  if (role === "CUSTOMER") {
    await gate4Prisma.customerProfile.create({
      data: { userId: user.id, displayName: `Customer ${tag}` },
    });
  } else if (role === "DRIVER") {
    const profile = await gate4Prisma.driverProfile.create({
      data: {
        userId: user.id,
        driverCode: tag.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-20),
        displayName: `Driver ${tag}`,
        active: true,
        status: "ACTIVE",
        availability: "AVAILABLE",
        maxConcurrentAssignments: 1,
      },
    });
    return { tag, user, driverProfile: profile };
  } else if (role === "STORE") {
    const profile = await gate4Prisma.storeProfile.create({
      data: {
        userId: user.id,
        storeName: `Store ${tag}`,
        status: "ACTIVE",
      },
    });
    return { tag, user, storeProfile: profile };
  } else if (role === "ADMIN") {
    const profile = await gate4Prisma.adminProfile.create({
      data: {
        userId: user.id,
        displayName: `Admin ${tag}`,
      },
    });
    return { tag, user, adminProfile: profile };
  }

  return { tag, user };
}

export async function createGate4Store(suite: string, test: string, ownerUserId?: string) {
  const tag = gate4Tag(suite, test);
  let ownerId = ownerUserId;
  if (!ownerId) {
    const owner = await createGate4User(suite, test, "STORE");
    ownerId = owner.user.id;
  }
  const store = await gate4Prisma.store.create({
    data: {
      ownerUserId: ownerId,
      name: `Gate4 Store ${tag}`,
      slug: tag,
      status: "ACTIVE",
    },
  });
  return { tag, store, ownerId };
}

export interface Gate4CatalogueProductOptions {
  lifecycle?: "DRAFT" | "ACTIVE";
}

export async function createGate4CatalogueProduct(
  suite: string,
  test: string,
  storeId: string,
  options: Gate4CatalogueProductOptions = {}
) {
  const tag = gate4Tag(suite, test);
  const admin = await createGate4User(suite, test, "ADMIN");
  const targetLifecycle = options.lifecycle ?? "DRAFT";

  const category = await gate4Prisma.catalogCategory.create({
    data: {
      publicReference: `cat_${tag}`,
      name: `Category ${tag}`,
      slug: tag,
      path: `cat/${tag}`,
      status: "ACTIVE",
      createdByUserId: admin.user.id,
      updatedByUserId: admin.user.id,
    },
  });

  const typeDef = await gate4Prisma.productTypeDefinition.create({
    data: {
      publicReference: `ptd_${tag}`,
      code: `CODE_${tag}`.slice(0, 50),
      name: `Type ${tag}`,
      versionNumber: 1,
      status: "ACTIVE",
      attributeSchema: {},
      variantSchema: {},
      complianceSchema: {},
      searchFacetSchema: {},
      createdByUserId: admin.user.id,
    },
  });

  const product = await gate4Prisma.catalogProduct.create({
    data: {
      publicReference: `prod_${tag}`,
      title: `Gate4 Product ${tag}`,
      normalizedTitle: `gate4 product ${tag}`,
      slug: tag,
      status: "DRAFT",
      scope: "STORE_PRIVATE",
      sourceStoreId: storeId,
      moderationStatus: "NOT_SUBMITTED",
      publicationStatus: "DRAFT",
      productTypeDefinitionId: typeDef.id,
      productTypeVersionNumber: typeDef.versionNumber,
      primaryCategoryId: category.id,
      attributeValues: {},
      complianceValues: {},
      qualityIssues: [],
      createdByUserId: admin.user.id,
    },
  });

  if (targetLifecycle === "ACTIVE") {
    await gate4Prisma.catalogProductVariant.create({
      data: {
        publicReference: `var_${tag}`,
        productId: product.id,
        title: `Variant ${tag}`,
        normalizedTitle: `variant ${tag}`,
        optionFingerprint: "fp_default",
        attributeValues: {},
        status: "ACTIVE",
      },
    });

    const activeProduct = await gate4Prisma.catalogProduct.update({
      where: { id: product.id },
      data: {
        moderationStatus: "APPROVED",
        publicationStatus: "PUBLISHED",
        status: "ACTIVE",
      },
    });

    return { tag, category, product: activeProduct, adminUser: admin.user };
  }

  return { tag, category, product, adminUser: admin.user };
}

export interface Gate4ActiveCatalogContext {
  tag: string;
  category: Prisma.CatalogCategoryGetPayload<object>;
  product: Prisma.CatalogProductGetPayload<object>;
  variant: Prisma.CatalogProductVariantGetPayload<object>;
  location: Prisma.InventoryLocationGetPayload<object>;
  offer: Prisma.StoreCatalogOfferGetPayload<object>;
  priceVersion: Prisma.StoreOfferPriceVersionGetPayload<object>;
  inventoryItem?: Prisma.CatalogInventoryItemGetPayload<object>;
  level?: Prisma.CatalogInventoryLevelGetPayload<object>;
  adminUser: Prisma.UserGetPayload<object>;
  store?: Prisma.StoreGetPayload<object>;
}

export async function createGate4ActiveProductScenario(
  suite: string,
  test: string,
  storeId: string,
  inventoryOptions?: { available?: number; reserved?: number; onHand?: number }
): Promise<Gate4ActiveCatalogContext> {
  return withGate4FixtureOperation(
    { scenario: "Catalog Active Product Staged Activation Fixture", builder: "createGate4ActiveProductScenario" },
    async () => {
      const tag = gate4Tag(suite, test);
      const { category, product, adminUser } = await createGate4CatalogueProduct(suite, test, storeId, { lifecycle: "DRAFT" });

      const variant = await withGate4FixtureOperation(
        { model: "CatalogProductVariant", operation: "create" },
        async () =>
          gate4Prisma.catalogProductVariant.create({
            data: {
              publicReference: `var_${tag}`,
              productId: product.id,
              title: `Variant ${tag}`,
              normalizedTitle: `variant ${tag}`,
              optionFingerprint: "fp_default",
              attributeValues: {},
              status: "ACTIVE",
            },
          })
      );

      const location = await withGate4FixtureOperation(
        { model: "InventoryLocation", operation: "create" },
        async () =>
          gate4Prisma.inventoryLocation.create({
            data: {
              publicReference: `loc_${tag}`,
              storeId,
              name: `Location ${tag}`,
              status: "ACTIVE",
            },
          })
      );

      const draftOffer = await withGate4FixtureOperation(
        { model: "StoreCatalogOffer", operation: "create" },
        async () =>
          gate4Prisma.storeCatalogOffer.create({
            data: {
              publicReference: `ofr_${tag}`,
              storeId,
              productId: product.id,
              variantId: variant.id,
              storeSku: `SKU-${tag}`.slice(0, 50),
              merchantTitle: `Offer ${tag}`,
              status: "DRAFT",
              publicationStatus: "DRAFT",
              inventoryTrackingMode: "TRACKED",
              primaryInventoryLocationId: location.id,
              createdByUserId: adminUser.id,
            },
          })
      );

      const priceVersion = await withGate4FixtureOperation(
        { model: "StoreOfferPriceVersion", operation: "create" },
        async () =>
          gate4Prisma.storeOfferPriceVersion.create({
            data: {
              publicReference: `prc_${tag}`,
              offerId: draftOffer.id,
              versionNumber: 1,
              amount: new Prisma.Decimal("100.00"),
              currency: "ZAR",
              status: "ACTIVE",
              effectiveFrom: new Date(Date.now() - 3600000),
              createdByUserId: adminUser.id,
            },
          })
      );

      const offerWithPrice = await withGate4FixtureOperation(
        { model: "StoreCatalogOffer", operation: "update" },
        async () =>
          gate4Prisma.storeCatalogOffer.update({
            where: { id: draftOffer.id },
            data: { currentPriceVersionId: priceVersion.id },
          })
      );

      const inventoryItem = await withGate4FixtureOperation(
        { model: "CatalogInventoryItem", operation: "create" },
        async () =>
          gate4Prisma.catalogInventoryItem.create({
            data: {
              publicReference: `item_${tag}`,
              offerId: offerWithPrice.id,
              variantId: variant.id,
              trackingMode: "TRACKED",
            },
          })
      );

      const avail = inventoryOptions?.available ?? 10;
      const res = inventoryOptions?.reserved ?? 0;
      const hand = inventoryOptions?.onHand ?? (avail + res);

      await withGate4FixtureOperation(
        { model: "CatalogInventoryMovement", operation: "create" },
        async () =>
          gate4Prisma.catalogInventoryMovement.create({
            data: {
              publicReference: `mov_${tag}`,
              inventoryItemId: inventoryItem.id,
              locationId: location.id,
              type: "INITIAL_STOCK",
              quantityDelta: hand,
              resultingOnHand: hand,
              operationId: `op_${tag}`,
              requestHash: "0".repeat(64),
              reasonCode: "FIXTURE_SETUP",
              actorUserId: adminUser.id,
            },
          })
      );

      const level = await withGate4FixtureOperation(
        { model: "CatalogInventoryLevel", operation: "create" },
        async () =>
          gate4Prisma.catalogInventoryLevel.create({
            data: {
              inventoryItemId: inventoryItem.id,
              locationId: location.id,
              available: avail,
              reserved: res,
              onHand: hand,
            },
          })
      );

      const activeProduct = await withGate4FixtureOperation(
        { model: "CatalogProduct", operation: "update" },
        async () =>
          gate4Prisma.catalogProduct.update({
            where: { id: product.id },
            data: {
              moderationStatus: "APPROVED",
              publicationStatus: "PUBLISHED",
              status: "ACTIVE",
            },
          })
      );

      const activeOffer = await withGate4FixtureOperation(
        { model: "StoreCatalogOffer", operation: "update" },
        async () =>
          gate4Prisma.storeCatalogOffer.update({
            where: { id: offerWithPrice.id },
            data: {
              publicationStatus: "PUBLISHED",
              status: "ACTIVE",
            },
          })
      );

      return {
        tag,
        category,
        product: activeProduct,
        variant,
        location,
        offer: activeOffer,
        priceVersion,
        inventoryItem,
        level,
        adminUser,
      };
    }
  );
}

export async function activateGate4CatalogProduct(productId: string) {
  const product = await gate4Prisma.catalogProduct.findUnique({ where: { id: productId } });
  if (!product) {
    throw new Gate4FixtureError(`CatalogProduct ${productId} not found for activation.`);
  }
  let variant = await gate4Prisma.catalogProductVariant.findFirst({ where: { productId: product.id, status: { not: "ARCHIVED" } } });
  if (!variant) {
    const tag = randomUUID().slice(0, 8);
    variant = await gate4Prisma.catalogProductVariant.create({
      data: {
        publicReference: `var_${tag}`,
        productId: product.id,
        title: `Variant ${tag}`,
        normalizedTitle: `variant ${tag}`,
        optionFingerprint: "fp_default",
        attributeValues: {},
        status: "ACTIVE",
      },
    });
  }
  return gate4Prisma.catalogProduct.update({
    where: { id: product.id },
    data: {
      moderationStatus: "APPROVED",
      publicationStatus: "PUBLISHED",
      status: "ACTIVE",
    },
  });
}

export function makeGate4PaymentAttemptPublicReference(tag: string): string {
  const cleanTag = tag.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 30);
  const suffix = randomUUID().replace(/-/g, "").slice(0, 24);
  const ref = `pat_${cleanTag}_${suffix}`;
  if (ref.length < 20) {
    return `pat_${cleanTag}_${suffix}${"0".repeat(20 - ref.length)}`;
  }
  return ref.slice(0, 100);
}

export function makeGate4PaymentWebhookPublicReference(tag: string): string {
  const cleanTag = tag.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 20);
  const suffix = randomUUID().replace(/-/g, "").slice(0, 24);
  const ref = `pwe_${cleanTag}_${suffix}`;
  if (ref.length < 20) {
    return `pwe_${cleanTag}_${suffix}${"0".repeat(20 - ref.length)}`;
  }
  return ref.slice(0, 100);
}

export function makeGate4PaymentWebhookFingerprint(tag: string): string {
  const cleanTag = tag.replace(/[^a-f0-9]/gi, "").toLowerCase();
  const hex = (cleanTag + randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "")).slice(0, 64);
  return hex.padEnd(64, "0");
}

export async function createGate4InventoryLevel(
  suite: string,
  test: string,
  productId: string,
  storeId: string,
  options: { available?: number; reserved?: number; onHand?: number } = {}
) {
  return withGate4FixtureOperation(
    { scenario: "Evidence-Backed Inventory Level Fixture", builder: "createGate4InventoryLevel" },
    async () => {
      const tag = gate4Tag(suite, test);
      const admin = await createGate4User(suite, test, "ADMIN");
      const avail = options.available ?? 1;
      const res = options.reserved ?? 0;
      const hand = options.onHand ?? (avail + res);

      if (avail < 0 || res < 0 || hand < 0 || avail + res !== hand) {
        throw new Gate4FixtureError(`CatalogInventoryLevel projection check invalid: available=${avail}, reserved=${res}, onHand=${hand}`);
      }

      let product = await gate4Prisma.catalogProduct.findUnique({ where: { id: productId } });
      if (!product) {
        throw new Gate4FixtureError(`Product ${productId} not found for inventory level creation.`);
      }

      let variant = await gate4Prisma.catalogProductVariant.findFirst({ where: { productId: product.id } });
      if (!variant) {
        variant = await withGate4FixtureOperation(
          { model: "CatalogProductVariant", operation: "create" },
          async () =>
            gate4Prisma.catalogProductVariant.create({
              data: {
                publicReference: `var_${tag}`,
                productId,
                title: `Variant ${tag}`,
                normalizedTitle: `variant ${tag}`,
                optionFingerprint: "fp_default",
                attributeValues: {},
                status: "ACTIVE",
              },
            })
        );
      }

      if (product.status === "DRAFT") {
        product = await activateGate4CatalogProduct(product.id);
      }

      let activeOffer = await gate4Prisma.storeCatalogOffer.findFirst({
        where: { storeId, variantId: variant.id },
      });

      let location: Prisma.InventoryLocationGetPayload<object> | null = null;
      let priceVersion: Prisma.StoreOfferPriceVersionGetPayload<object> | null = null;

      if (activeOffer && activeOffer.primaryInventoryLocationId) {
        location = await gate4Prisma.inventoryLocation.findUnique({
          where: { id: activeOffer.primaryInventoryLocationId },
        });
      }

      if (!location) {
        location = await withGate4FixtureOperation(
          { model: "InventoryLocation", operation: "create" },
          async () =>
            gate4Prisma.inventoryLocation.create({
              data: {
                publicReference: `loc_${tag}`,
                storeId,
                name: `Location ${tag}`,
                status: "ACTIVE",
              },
            })
        );
      }

      if (!activeOffer) {
        const draftOffer = await withGate4FixtureOperation(
          { model: "StoreCatalogOffer", operation: "create" },
          async () =>
            gate4Prisma.storeCatalogOffer.create({
              data: {
                publicReference: `ofr_${tag}`,
                storeId,
                productId,
                variantId: variant.id,
                storeSku: `SKU-${tag}`.slice(0, 50),
                merchantTitle: `Offer ${tag}`,
                status: "DRAFT",
                publicationStatus: "PUBLISHED",
                inventoryTrackingMode: "TRACKED",
                primaryInventoryLocationId: location.id,
                createdByUserId: admin.user.id,
              },
            })
        );

        priceVersion = await withGate4FixtureOperation(
          { model: "StoreOfferPriceVersion", operation: "create" },
          async () =>
            gate4Prisma.storeOfferPriceVersion.create({
              data: {
                publicReference: `prc_${tag}`,
                offerId: draftOffer.id,
                versionNumber: 1,
                amount: new Prisma.Decimal("100.00"),
                currency: "ZAR",
                status: "ACTIVE",
                effectiveFrom: new Date(Date.now() - 3600000),
                createdByUserId: admin.user.id,
              },
            })
        );

        activeOffer = await withGate4FixtureOperation(
          { model: "StoreCatalogOffer", operation: "update" },
          async () =>
            gate4Prisma.storeCatalogOffer.update({
              where: { id: draftOffer.id },
              data: { currentPriceVersionId: priceVersion!.id, status: "ACTIVE" },
            })
        );
      }

      let inventoryItem = await gate4Prisma.catalogInventoryItem.findFirst({
        where: { offerId: activeOffer.id, variantId: variant.id },
      });

      if (!inventoryItem) {
        inventoryItem = await withGate4FixtureOperation(
          { model: "CatalogInventoryItem", operation: "create" },
          async () =>
            gate4Prisma.catalogInventoryItem.create({
              data: {
                publicReference: `item_${tag}`,
                offerId: activeOffer.id,
                variantId: variant.id,
                trackingMode: "TRACKED",
              },
            })
        );
      }

      const existingLevel = await gate4Prisma.catalogInventoryLevel.findUnique({
        where: {
          inventoryItemId_locationId: {
            inventoryItemId: inventoryItem.id,
            locationId: location.id,
          },
        },
      });

      if (existingLevel) {
        if (existingLevel.available === avail && existingLevel.reserved === res && existingLevel.onHand === hand) {
          return { tag, variant, offer: activeOffer, priceVersion, inventoryItem, location, level: existingLevel };
        }
        const delta = hand - existingLevel.onHand;
        const [updatedLevel] = await gate4Prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET CONSTRAINTS ALL DEFERRED;`);
          await withGate4FixtureOperation(
            { model: "CatalogInventoryMovement", operation: "create" },
            async () =>
              tx.catalogInventoryMovement.create({
                data: {
                  publicReference: `mov_${tag}_${randomUUID().slice(0, 6)}`,
                  inventoryItemId: inventoryItem.id,
                  locationId: location.id,
                  type: "MANUAL_CORRECTION",
                  quantityDelta: delta,
                  resultingOnHand: hand,
                  operationId: `op_${tag}_${randomUUID().slice(0, 6)}`,
                  requestHash: "0".repeat(64),
                  reasonCode: "FIXTURE_ADJUSTMENT",
                  actorUserId: admin.user.id,
                },
              })
          );
          const lvl = await withGate4FixtureOperation(
            { model: "CatalogInventoryLevel", operation: "update" },
            async () =>
              tx.catalogInventoryLevel.update({
                where: { id: existingLevel.id },
                data: {
                  available: avail,
                  reserved: res,
                  onHand: hand,
                },
              })
          );
          return [lvl];
        });
        return { tag, variant, offer: activeOffer, priceVersion, inventoryItem, location, level: updatedLevel };
      }

      await withGate4FixtureOperation(
        { model: "CatalogInventoryMovement", operation: "create" },
        async () =>
          gate4Prisma.catalogInventoryMovement.create({
            data: {
              publicReference: `mov_${tag}`,
              inventoryItemId: inventoryItem.id,
              locationId: location.id,
              type: "INITIAL_STOCK",
              quantityDelta: hand,
              resultingOnHand: hand,
              operationId: `op_${tag}`,
              requestHash: "0".repeat(64),
              reasonCode: "FIXTURE_SETUP",
              actorUserId: admin.user.id,
            },
          })
      );

      const level = await withGate4FixtureOperation(
        { model: "CatalogInventoryLevel", operation: "create" },
        async () =>
          gate4Prisma.catalogInventoryLevel.create({
            data: {
              inventoryItemId: inventoryItem.id,
              locationId: location.id,
              available: avail,
              reserved: res,
              onHand: hand,
            },
          })
      );

      return { tag, variant, offer: activeOffer, priceVersion, inventoryItem, location, level };
    }
  );
}

export async function createGate4InventoryForCatalog(
  context: Gate4ActiveCatalogContext,
  options: { available?: number; reserved?: number; onHand?: number } = {}
) {
  const storeId = context.store?.id || context.product.sourceStoreId || "";
  return createGate4InventoryLevel("bootstrap", "inv-lvl", context.product.id, storeId, options);
}

export async function createGate4CheckoutScenario(suite: string, test: string) {
  const tag = gate4Tag(suite, test);
  const customer = await createGate4User(suite, test, "CUSTOMER");
  const store = await createGate4Store(suite, test);
  const activeScenario = await createGate4ActiveProductScenario(suite, test, store.store.id);

  const cart = await gate4Prisma.marketplaceCart.create({
    data: {
      publicReference: `cart_${tag}`,
      ownerType: "CUSTOMER",
      customerUserId: customer.user.id,
      status: "ACTIVE",
      currency: "ZAR",
    },
  });

  return {
    tag,
    customer: customer.user,
    store: store.store,
    product: activeScenario.product,
    offer: activeScenario.offer,
    variant: activeScenario.variant,
    inventory: activeScenario.level,
    cart,
  };
}

export async function createGate4Region(suite: string, test: string) {
  const tag = gate4Tag(suite, test);
  const region = await gate4Prisma.deliveryRegion.create({
    data: {
      name: `Region ${tag}`,
      slug: tag,
      active: true,
      pricingEnabled: true,
      city: "Johannesburg",
      province: "Gauteng",
    },
  });
  return { tag, region };
}

export async function createGate4PendingDeliveryScenario(suite: string, test: string, driverCount = 5) {
  const tag = gate4Tag(suite, test);
  const customer = await createGate4User(suite, test, "CUSTOMER");
  const { region } = await createGate4Region(suite, test);

  const order = await gate4Prisma.order.create({
    data: {
      orderNumber: `G4-${tag}`.slice(0, 50),
      source: "CUSTOMER",
      status: "PENDING",
      deliveryType: "SAME_DAY",
      currency: "ZAR",
      customerId: customer.user.id,
      deliveryRegionId: region.id,
      recipientName: "Gate4 Recipient",
      recipientPhone: "+27110000000",
      parcelCount: 1,
      priceEstimate: new Prisma.Decimal("125.00"),
      pricingSubtotal: new Prisma.Decimal("100.00"),
      pricingTaxAmount: new Prisma.Decimal("25.00"),
      pricingTaxRate: new Prisma.Decimal("0.2500"),
    },
  });

  const drivers = [];
  for (let i = 0; i < driverCount; i++) {
    const d = await createGate4User(`${suite}-${i}`, test, "DRIVER");
    drivers.push(d);
  }

  return { tag, customer: customer.user, region, order, drivers };
}

export async function createGate4AcceptedAssignmentScenario(suite: string, test: string) {
  const scenario = await createGate4PendingDeliveryScenario(suite, test, 1);
  const driver = scenario.drivers[0];
  requireGate4Fixture(driver.driverProfile, "Driver profile expected");
  const driverProfileId = driver.driverProfile!.id;

  assertValidOrderAssignmentFixtureInput({
    status: "ACCEPTED",
    activeOrderGuard: scenario.order.id,
  } as unknown as Prisma.OrderAssignmentCreateInput);

  if (!driverProfileId || !scenario.order.id) {
    throw new Gate4FixtureError("GATE4_ACCEPTED_ASSIGNMENT_FIXTURE_CONTRACT_INVALID");
  }

  const assignment = await gate4Prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET CONSTRAINTS ALL DEFERRED;`);
    const createdAssignment = await tx.orderAssignment.create({
      data: {
        orderId: scenario.order.id,
        driverProfileId,
        assignedByAdminId: scenario.customer.id,
        status: "ACCEPTED",
        activeOrderGuard: scenario.order.id,
        assignedAt: new Date(),
        acceptedAt: new Date(),
      },
    });
    await tx.order.update({
      where: { id: scenario.order.id },
      data: { currentDriverProfileId: driverProfileId, status: "IN_PROGRESS" },
    });
    return createdAssignment;
  });

  return { ...scenario, driverProfile: driver.driverProfile!, assignment };
}

export async function createGate4CapturedPaymentScenario(
  suite: string,
  test: string,
  options: { status?: "PROCESSING" | "SUCCEEDED" | "RESERVED"; amount?: string } = {}
) {
  return withGate4FixtureOperation(
    { scenario: "Captured Payment ITN Fixture", builder: "createGate4CapturedPaymentScenario" },
    async () => {
      const tag = gate4Tag(suite, test);
      const customer = await createGate4User(suite, test, "CUSTOMER");
      const amountStr = options.amount ?? "100.00";
      const amountDec = new Prisma.Decimal(amountStr);

      const quote = await withGate4FixtureOperation(
        { model: "PricingQuote", operation: "create" },
        async () =>
          gate4Prisma.pricingQuote.create({
            data: {
              status: "USED",
              ownerType: "CUSTOMER",
              ownerId: customer.user.id,
              deliveryType: "SAME_DAY",
              currency: "ZAR",
              calculationVersion: "gate4-v1",
              inputHash: "0".repeat(64),
              distanceMeters: 1000,
              rawDistanceKm: new Prisma.Decimal("1.0000"),
              billableDistanceKm: new Prisma.Decimal("1.0000"),
              subtotal: amountDec,
              taxRate: new Prisma.Decimal("0.1500"),
              taxAmount: new Prisma.Decimal("15.00"),
              total: amountDec.add(15),
              inputSnapshot: {},
              ruleSnapshot: {},
              regionSnapshot: {},
              taxSnapshot: {},
              expiresAt: new Date(Date.now() + 86400000),
              usedAt: new Date(),
            },
          })
      );

      const order = await withGate4FixtureOperation(
        { model: "Order", operation: "create" },
        async () =>
          gate4Prisma.order.create({
            data: {
              orderNumber: `ORD-G4-${tag}`.slice(0, 50),
              source: "CUSTOMER",
              status: "CONFIRMED",
              deliveryType: "SAME_DAY",
              currency: "ZAR",
              customerId: customer.user.id,
              priceEstimate: amountDec,
              pricingQuoteId: quote.id,
              pricingSubtotal: amountDec,
              pricingTaxAmount: new Prisma.Decimal("15.00"),
              pricingTaxRate: new Prisma.Decimal("0.1500"),
            },
          })
      );

      const payment = await withGate4FixtureOperation(
        { model: "Payment", operation: "create" },
        async () =>
          gate4Prisma.payment.create({
            data: {
              publicReference: `pay_g4_${tag}`,
              orderId: order.id,
              userId: customer.user.id,
              subjectType: "COURIER_ORDER",
              provider: "PAYFAST",
              purpose: "ORDER",
              currency: "ZAR",
              amount: amountDec,
              creationIdempotencyKey: `idem_pay_${tag}`,
              creationRequestHash: "0".repeat(64),
              status: "PROCESSING",
            },
          })
      );

      const attemptPublicReference = makeGate4PaymentAttemptPublicReference(tag);

      assertValidPaymentAttemptFixtureInput({
        publicReference: attemptPublicReference,
        requestHash: "0".repeat(64),
        idempotencyKey: `idem_att_${tag}`.slice(0, 128),
      } as unknown as Prisma.PaymentAttemptCreateInput);

      const attempt = await withGate4FixtureOperation(
        { model: "PaymentAttempt", operation: "create" },
        async () =>
          gate4Prisma.paymentAttempt.create({
            data: {
              publicReference: attemptPublicReference,
              paymentId: payment.id,
              merchantReference: `mref_g4_${tag}`.slice(0, 100),
              provider: "PAYFAST",
              providerEnvironment: "SANDBOX",
              amount: amountDec,
              currency: "ZAR",
              attemptNumber: 1,
              idempotencyKey: `idem_att_${tag}`.slice(0, 128),
              requestHash: "0".repeat(64),
              status: options.status === "SUCCEEDED" ? "SUCCEEDED" : "PROCESSING",
            },
          })
      );

      if (options.status === "SUCCEEDED") {
        const journal = await withGate4FixtureOperation(
          { model: "LedgerJournal", operation: "create" },
          async () =>
            gate4Prisma.ledgerJournal.create({
              data: {
                reference: `jnl_pay_${tag}`,
                type: "EXTERNAL_PAYMENT_RECEIPT",
                currency: "ZAR",
                idempotencyKey: `idem_jnl_${tag}`,
                correlationId: payment.publicReference,
                requestHash: "0".repeat(64),
                policyVersion: "v1",
                totalDebits: amountDec,
                totalCredits: amountDec,
                postedAt: new Date(),
              },
            })
        );

        const webhookData = {
          publicReference: makeGate4PaymentWebhookPublicReference(tag),
          provider: "PAYFAST" as const,
          environment: "SANDBOX" as const,
          eventFingerprint: makeGate4PaymentWebhookFingerprint(tag),
          merchantReference: attempt.merchantReference,
          providerPaymentId: `pf_${tag}`,
          providerStatus: "COMPLETE",
          normalizedStatus: "COMPLETE" as const,
          processingStatus: "APPLIED" as const,
          paymentId: payment.id,
          attemptId: attempt.id,
          ledgerJournalId: journal.id,
          sourceAddressVerified: true,
          signatureVerified: true,
          merchantVerified: true,
          amountVerified: true,
          providerDataVerified: true,
          verifiedAt: new Date(),
          appliedAt: new Date(),
        };

        assertValidPaymentWebhookEventFixtureInput(webhookData);

        const webhook = await withGate4FixtureOperation(
          { model: "PaymentWebhookEvent", operation: "create" },
          async () =>
            gate4Prisma.paymentWebhookEvent.create({
              data: webhookData,
            })
        );

        const succeededPayment = await withGate4FixtureOperation(
          { model: "Payment", operation: "update" },
          async () =>
            gate4Prisma.payment.update({
              where: { id: payment.id },
              data: {
                status: "SUCCEEDED",
                providerConfirmedAt: new Date(),
                successfulAttemptId: attempt.id,
                successWebhookEventId: webhook.id,
                successLedgerJournalId: journal.id,
                version: { increment: 1 },
              },
            })
        );

        return { tag, customer: customer.user, order, payment: succeededPayment, attempt, webhook, journal };
      }

      return { tag, customer: customer.user, order, payment, attempt };
    }
  );
}

export async function createGate4LedgerScenario(suite: string, test: string) {
  const tag = gate4Tag(suite, test);

  const walletA = await gate4Prisma.wallet.create({
    data: {
      ownerType: "STORE",
      ownerId: `owner_a_${tag}`,
      currency: "ZAR",
      status: "ACTIVE",
    },
  });

  const walletB = await gate4Prisma.wallet.create({
    data: {
      ownerType: "STORE",
      ownerId: `owner_b_${tag}`,
      currency: "ZAR",
      status: "ACTIVE",
    },
  });

  const accountA = await gate4Prisma.ledgerAccount.create({
    data: {
      walletId: walletA.id,
      code: `1000-${tag}`.slice(0, 50),
      purpose: "AVAILABLE",
      category: "ASSET",
      currency: "ZAR",
    },
  });

  const accountB = await gate4Prisma.ledgerAccount.create({
    data: {
      walletId: walletB.id,
      code: `2000-${tag}`.slice(0, 50),
      purpose: "AVAILABLE",
      category: "LIABILITY",
      currency: "ZAR",
    },
  });

  return { tag, accountA, accountB };
}

export async function createGate4FundedStoreWalletScenario(suite: string, test: string, amount = "100.00") {
  const tag = gate4Tag(suite, test);
  const { store, ownerId } = await createGate4Store(suite, test);

  const wallet = await gate4Prisma.wallet.create({
    data: {
      ownerType: "STORE",
      ownerId: store.id,
      currency: "ZAR",
      availableBalance: new Prisma.Decimal("0.00"),
      pendingBalance: new Prisma.Decimal("0.00"),
      lockedBalance: new Prisma.Decimal("0.00"),
      status: "ACTIVE",
    },
  });

  const account = await gate4Prisma.ledgerAccount.create({
    data: {
      walletId: wallet.id,
      code: `MERCHANT-PAYABLE-${tag}`.slice(0, 50),
      purpose: "AVAILABLE",
      category: "LIABILITY",
      currency: "ZAR",
      status: "ACTIVE",
      currentBalance: new Prisma.Decimal(amount),
      creditTotal: new Prisma.Decimal(amount),
    },
  });

  return { tag, store, ownerId, wallet, account };
}

export async function createGate4MarketplaceStoreOrderScenario(suite: string, test: string) {
  const tag = gate4Tag(suite, test);
  const customer = await createGate4User(suite, test, "CUSTOMER");
  const { store } = await createGate4Store(suite, test);
  const { payment } = await createGate4CapturedPaymentScenario(suite, test, { status: "SUCCEEDED", amount: "100.00" });

  const cart = await gate4Prisma.marketplaceCart.create({
    data: {
      publicReference: `cart_grp_${tag}`,
      ownerType: "CUSTOMER",
      customerUserId: customer.user.id,
      status: "ACTIVE",
      currency: "ZAR",
    },
  });

  const checkout = await gate4Prisma.marketplaceCheckout.create({
    data: {
      publicReference: `chk_mko_${tag}`,
      cartId: cart.id,
      status: "READY_FOR_REVIEW",
      acceptedFingerprint: "fp_test_123",
      merchandiseSubtotal: new Prisma.Decimal("100.00"),
      deliveryFeeTotal: new Prisma.Decimal("15.00"),
      grandTotal: new Prisma.Decimal("115.00"),
      currency: "ZAR",
    },
  });

  const marketplaceOrder = await gate4Prisma.marketplaceOrder.create({
    data: {
      publicReference: `mso_g4_${tag}`,
      checkoutId: checkout.id,
      paymentId: payment.id,
      customerUserId: customer.user.id,
      currency: "ZAR",
      merchandiseSubtotal: new Prisma.Decimal("100.00"),
      modifierSubtotal: new Prisma.Decimal("0.00"),
      deliveryFeeTotal: new Prisma.Decimal("15.00"),
      grandTotal: new Prisma.Decimal("115.00"),
      status: "CONFIRMED",
      commercialFingerprint: "fp_test_123",
    },
  });

  const group = await gate4Prisma.marketplaceCheckoutStoreGroup.create({
    data: {
      checkoutId: checkout.id,
      storeId: store.id,
      fulfilmentMode: "COURIER_DELIVERY",
    },
  });

  const storeOrder = await gate4Prisma.marketplaceStoreOrder.create({
    data: {
      publicReference: `mso_g4_${tag}`,
      marketplaceOrderId: marketplaceOrder.id,
      checkoutStoreGroupId: group.id,
      storeId: store.id,
      merchandiseSubtotal: new Prisma.Decimal("100.00"),
      modifierSubtotal: new Prisma.Decimal("0.00"),
      deliveryFee: new Prisma.Decimal("15.00"),
      groupTotal: new Prisma.Decimal("115.00"),
      status: "PENDING_SETTLEMENT",
    },
  });

  return { tag, customer: customer.user, store, marketplaceOrder, storeOrder, payment };
}

export function assertValidCatalogProductFixtureInput(data: Prisma.CatalogProductCreateInput) {
  if (data.qualityIssues != null && !Array.isArray(data.qualityIssues)) {
    throw new Gate4FixtureError("CatalogProduct_quality_check constraint violation: qualityIssues must be an array");
  }
}

export function assertValidOrderAssignmentFixtureInput(data: Prisma.OrderAssignmentCreateInput) {
  if ((data.status === "ASSIGNED" || data.status === "ACCEPTED") && !data.activeOrderGuard) {
    throw new Gate4FixtureError("OrderAssignment_current_guard_consistency constraint violation: activeOrderGuard required");
  }
}

export function assertValidPaymentFixtureInput(data: Prisma.PaymentCreateInput) {
  if (data.status === "SUCCEEDED" && (!data.successfulAttempt || !data.successWebhookEvent || !data.successLedgerJournal || !data.providerConfirmedAt)) {
    throw new Gate4FixtureError("Payment_succeeded_requires_provider_evidence_check constraint violation: missing evidence");
  }
}

export function assertValidWalletFixtureInput(data: Prisma.WalletCreateInput) {
  if (data.availableBalance && new Prisma.Decimal(data.availableBalance.toString()).toNumber() !== 0) {
    throw new Gate4FixtureError("Wallet_legacy_balances_zero_check constraint violation: availableBalance must be 0");
  }
}

export function assertValidPaymentAttemptFixtureInput(data: Prisma.PaymentAttemptCreateInput) {
  if (data.publicReference != null) {
    const len = data.publicReference.length;
    if (len < 20 || len > 100 || !/^pat_[A-Za-z0-9_-]+$/.test(data.publicReference)) {
      throw new Gate4FixtureError(`PaymentAttempt_public_reference_check constraint violation: invalid publicReference '${data.publicReference}'`);
    }
  }
  if (data.requestHash != null && data.requestHash.length !== 64) {
    throw new Gate4FixtureError("PaymentAttempt_request_hash_check constraint violation: requestHash must be 64 characters");
  }
  if (data.idempotencyKey != null) {
    const trimmed = data.idempotencyKey.trim();
    if (trimmed.length < 8 || trimmed.length > 128) {
      throw new Gate4FixtureError("PaymentAttempt_idempotency_key_nonempty_check constraint violation");
    }
  }
}

export function assertValidPaymentWebhookEventFixtureInput(
  data: Record<string, unknown>
) {
  const pubRef = typeof data.publicReference === "string" ? data.publicReference : null;
  const fp = typeof data.eventFingerprint === "string" ? data.eventFingerprint : null;
  const procStatus = typeof data.processingStatus === "string" ? data.processingStatus : null;
  const normStatus = typeof data.normalizedStatus === "string" ? data.normalizedStatus : null;

  if (pubRef != null) {
    const len = pubRef.length;
    if (len < 20 || len > 100 || !/^pwe_[A-Za-z0-9_-]+$/.test(pubRef)) {
      throw new Gate4FixtureError(`PaymentWebhookEvent_public_reference_check constraint violation: invalid publicReference '${pubRef}'`);
    }
  }
  if (fp != null) {
    if (!/^[a-f0-9]{64}$/.test(fp)) {
      throw new Gate4FixtureError("PaymentWebhookEvent_fingerprint_check constraint violation: eventFingerprint must be 64-character lowercase hex");
    }
  }
  if (procStatus === "APPLIED" || procStatus === "VERIFIED" || procStatus === "DUPLICATE" || procStatus === "IGNORED_STALE") {
    const paymentId = data.paymentId || (data.payment as { connect?: { id?: string } })?.connect?.id;
    const attemptId = data.attemptId || (data.attempt as { connect?: { id?: string } })?.connect?.id;
    if (!data.sourceAddressVerified || !data.signatureVerified || !data.merchantVerified || !data.amountVerified || !data.providerDataVerified || !data.verifiedAt || !paymentId || !attemptId) {
      throw new Gate4FixtureError("PaymentWebhookEvent_verified_coherence_check constraint violation: missing verification fields");
    }
  }
  if (procStatus === "APPLIED") {
    if (!data.appliedAt) {
      throw new Gate4FixtureError("PaymentWebhookEvent_applied_coherence_check constraint violation: appliedAt required for APPLIED status");
    }
    const ledgerJournalId = data.ledgerJournalId || (data.ledgerJournal as { connect?: { id?: string } })?.connect?.id;
    if (normStatus === "COMPLETE" && !ledgerJournalId) {
      throw new Gate4FixtureError("PaymentWebhookEvent_applied_coherence_check constraint violation: ledgerJournalId required when normalizedStatus is COMPLETE");
    }
  }
}

export async function createGate4AdminAuditScenario(suite: string, test: string) {
  const tag = gate4Tag(suite, test);
  const admin = await createGate4User(suite, test, "ADMIN");
  const customer = await createGate4User(suite, test, "CUSTOMER");

  return { tag, adminUser: admin.user, targetUser: customer.user };
}
