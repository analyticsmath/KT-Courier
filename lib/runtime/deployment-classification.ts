/**
 * KT Couriers — Canonical Runtime & Deployment Classification Authority
 * 
 * Establishes a single, authoritative classification of application execution environments
 * with strict production precedence and fail-closed handling of contradictory configurations.
 * 
 * Runtimes:
 * - "local-demo": Local developer demo on disposable/local database with explicit opt-ins.
 * - "test": CI / unit / integration test harness under injected or test authorities.
 * - "staging-demo": Staging demonstration deployment with Next.js production build and Paystack sandbox.
 * - "production": Live production environment. Strictly fail-closed until formal production approvals.
 * 
 * Architectural Invariants:
 * 1. Production Precedence: If the underlying database or environment is classified as production,
 *    staging flags cannot downgrade safety rules. Production safety wins unconditionally.
 * 2. Fail Closed: Contradictory classifications (e.g. production DB with staging runtime env)
 *    resolve to invalid/fail-closed state.
 * 3. Provider Decoupled: Infrastructure classification does not import payment providers.
 */

export type KtRuntimeEnvironment = "local-demo" | "test" | "staging-demo" | "production";

export type RuntimeClassificationResolution = Readonly<{
  runtime: KtRuntimeEnvironment;
  isValid: boolean;
  conflictReason: string | null;
  isProductionBuild: boolean;
  isStagingDemo: boolean;
  isTest: boolean;
  isLocalDemo: boolean;
}>;

export type RuntimeGateDecision = Readonly<{
  runtime: KtRuntimeEnvironment;
  isValid: boolean;
  storefrontAllowed: boolean;
  storefrontBlockReason: string | null;
  demoMediaAllowed: boolean;
  demoMediaBlockReason: string | null;
  checkoutAllowed: boolean;
  checkoutBlockReason: string | null;
  liveMoneyAllowed: boolean;
}>;

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

const PRODUCTION_MARKERS = ["prod", "production", "live", "rds.amazonaws.com", "cloudsql", "supabase.co", "neon.tech", "azure.com"];

function isDatabaseProductionLike(dbUrl: string | undefined): boolean {
  if (!dbUrl || !dbUrl.trim()) return false;
  try {
    const parsed = new URL(dbUrl);
    const dbName = parsed.pathname.replace(/^\//, "").toLowerCase();
    const host = parsed.hostname.toLowerCase();
    if (dbName === "kt_courier" || dbName === "kt_courier_production") return true;
    const fullLower = dbUrl.toLowerCase();
    return PRODUCTION_MARKERS.some((marker) => host.includes(marker) || fullLower.includes(marker));
  } catch {
    return false;
  }
}

/**
 * Classifies the active runtime environment using multiple independent signals.
 * Fails closed on any contradictory configuration.
 */
export function classifyRuntimeEnvironment(
  source: EnvironmentSource = process.env,
): RuntimeClassificationResolution {
  const nodeEnv = source.NODE_ENV?.trim().toLowerCase();
  const rawKtEnv = source.KT_RUNTIME_ENV?.trim().toLowerCase();
  const dbClassification = source.KT_DATABASE_CLASSIFICATION?.trim().toLowerCase();
  const stagingDemoFlag = source.KT_STAGING_DEMO_ENABLED?.trim().toLowerCase() === "true";
  const dbUrl = source.DATABASE_URL?.trim();

  const isProdBuild = nodeEnv === "production";
  const isDbProd = dbClassification === "production" || isDatabaseProductionLike(dbUrl);

  // 1. Check for Test / CI
  if (nodeEnv === "test" || rawKtEnv === "test" || rawKtEnv === "e2e") {
    // If DB is production, even test cannot touch it without explicit violation
    if (isDbProd) {
      return Object.freeze({
        runtime: "production",
        isValid: false,
        conflictReason: "DATABASE_CLASSIFIED_PRODUCTION_DURING_TEST",
        isProductionBuild: false,
        isStagingDemo: false,
        isTest: false,
        isLocalDemo: false,
      });
    }
    return Object.freeze({
      runtime: "test",
      isValid: true,
      conflictReason: null,
      isProductionBuild: isProdBuild,
      isStagingDemo: false,
      isTest: true,
      isLocalDemo: false,
    });
  }

  // 2. Production Precedence: If DB is classified production, production rules win unconditionally.
  // Staging flags CANNOT downgrade a production database.
  if (isDbProd) {
    if (rawKtEnv === "staging-demo" || stagingDemoFlag || dbClassification === "staging") {
      return Object.freeze({
        runtime: "production",
        isValid: false,
        conflictReason: "CONTRADICTORY_PRODUCTION_DATABASE_WITH_STAGING_FLAG",
        isProductionBuild: isProdBuild,
        isStagingDemo: false,
        isTest: false,
        isLocalDemo: false,
      });
    }
    return Object.freeze({
      runtime: "production",
      isValid: true,
      conflictReason: null,
      isProductionBuild: isProdBuild,
      isStagingDemo: false,
      isTest: false,
      isLocalDemo: false,
    });
  }

  // 3. Staging-Demo Runtime
  // Requires coherent conjunction of signals:
  // - KT_RUNTIME_ENV === "staging-demo"
  // - KT_STAGING_DEMO_ENABLED === "true"
  // - KT_DATABASE_CLASSIFICATION !== "production"
  // - DATABASE_URL not reserved production database
  if (rawKtEnv === "staging-demo") {
    if (!stagingDemoFlag) {
      return Object.freeze({
        runtime: "staging-demo",
        isValid: false,
        conflictReason: "STAGING_DEMO_FLAG_MISSING",
        isProductionBuild: isProdBuild,
        isStagingDemo: false,
        isTest: false,
        isLocalDemo: false,
      });
    }

    if (dbClassification && dbClassification !== "staging" && dbClassification !== "test") {
      return Object.freeze({
        runtime: "staging-demo",
        isValid: false,
        conflictReason: "CONTRADICTORY_DATABASE_CLASSIFICATION_FOR_STAGING",
        isProductionBuild: isProdBuild,
        isStagingDemo: false,
        isTest: false,
        isLocalDemo: false,
      });
    }

    return Object.freeze({
      runtime: "staging-demo",
      isValid: true,
      conflictReason: null,
      isProductionBuild: isProdBuild,
      isStagingDemo: true,
      isTest: false,
      isLocalDemo: false,
    });
  }

  // Staging demo flag set without KT_RUNTIME_ENV=staging-demo is an inconsistent configuration
  if (stagingDemoFlag) {
    if (isProdBuild) {
      return Object.freeze({
        runtime: "production",
        isValid: false,
        conflictReason: "STAGING_FLAG_PRESENT_WITHOUT_STAGING_RUNTIME_ENV_IN_PRODUCTION",
        isProductionBuild: isProdBuild,
        isStagingDemo: false,
        isTest: false,
        isLocalDemo: false,
      });
    }
    // In dev, treat as local-demo
    return Object.freeze({
      runtime: "local-demo",
      isValid: true,
      conflictReason: null,
      isProductionBuild: false,
      isStagingDemo: false,
      isTest: false,
      isLocalDemo: true,
    });
  }

  // 4. Standard Production Runtime
  if (isProdBuild || rawKtEnv === "production" || dbClassification === "production") {
    return Object.freeze({
      runtime: "production",
      isValid: true,
      conflictReason: null,
      isProductionBuild: isProdBuild,
      isStagingDemo: false,
      isTest: false,
      isLocalDemo: false,
    });
  }

  // 5. Local Demo / Development
  return Object.freeze({
    runtime: "local-demo",
    isValid: true,
    conflictReason: null,
    isProductionBuild: false,
    isStagingDemo: false,
    isTest: false,
    isLocalDemo: true,
  });
}

/**
 * Evaluates whether public storefront catalog exposure is permitted for the given environment.
 */
export function isStorefrontExposureAllowed(
  source: EnvironmentSource = process.env,
  productionApproved = false,
): boolean {
  const classification = classifyRuntimeEnvironment(source);
  if (!classification.isValid) return false;

  switch (classification.runtime) {
    case "test":
    case "local-demo": {
      const explicitOptIn =
        source.KT_LOCAL_STOREFRONT_VALIDATION === "true" ||
        source.KT_LOCAL_STOREFRONT_VALIDATION === "1" ||
        source.KT_DEMO_DATA_ENABLED === "true" ||
        source.KT_STAGING_DEMO_ENABLED === "true";
      return explicitOptIn;
    }
    case "staging-demo":
      return classification.isStagingDemo;
    case "production":
      return productionApproved;
  }
}

/**
 * Evaluates whether demo media delivery (e.g. local filesystem catalog media storage)
 * is permitted for the given environment.
 * 
 * CRITICAL SAFETY INVARIANT:
 * In production runtime, filesystem catalog media storage must NEVER become public
 * merely because CATALOG_MEDIA_STORAGE=filesystem or KT_STAGING_DEMO_ENABLED was set.
 * Production must remain locked unless the production media authority is explicitly approved.
 */
export function isDemoMediaDeliveryAllowed(
  source: EnvironmentSource = process.env,
  productionApproved = false,
): boolean {
  if (productionApproved) return true;
  const classification = classifyRuntimeEnvironment(source);
  if (!classification.isValid) return false;

  switch (classification.runtime) {
    case "test":
    case "local-demo":
      return (
        source.CATALOG_MEDIA_STORAGE === "filesystem" ||
        source.KT_STAGING_DEMO_ENABLED === "true" ||
        source.KT_DEMO_DATA_ENABLED === "true"
      );
    case "staging-demo":
      return classification.isStagingDemo;
    case "production":
      // In production, filesystem storage cannot unlock delivery; only formal production approval
      return productionApproved;
  }
}

/**
 * Evaluates whether checkout is permitted in principle for the given environment.
 * Note: Payment provider resolution (e.g. Paystack configuration) is independently
 * evaluated by the checkout gate authority.
 */
export function isCheckoutExposureAllowed(
  source: EnvironmentSource = process.env,
  productionApproved = false,
): boolean {
  if (productionApproved) return true;
  const classification = classifyRuntimeEnvironment(source);
  if (!classification.isValid) return false;

  switch (classification.runtime) {
    case "test":
    case "local-demo": {
      const localOptIn =
        source.KT_LOCAL_CHECKOUT_VALIDATION === "true" ||
        source.KT_LOCAL_CHECKOUT_VALIDATION === "1" ||
        source.KT_LOCAL_FULL_FLOW === "true" ||
        source.KT_LOCAL_FULL_FLOW === "1" ||
        source.CHECKOUT_PUBLIC_ENABLED === "true";
      return localOptIn;
    }
    case "staging-demo":
      return source.CHECKOUT_PUBLIC_ENABLED === "true";
    case "production":
      return productionApproved && source.CHECKOUT_PUBLIC_ENABLED === "true";
  }
}

/**
 * Evaluates whether live money transactions (real external payment settlements / payouts)
 * are permitted.
 * 
 * CRITICAL INVARIANT:
 * Live money is STRICTLY FORBIDDEN in local-demo, test, and staging-demo.
 * Only approved production with explicit payout approvals may process live money.
 */
export function isLiveMoneyAllowed(
  source: EnvironmentSource = process.env,
  productionApproved = false,
): boolean {
  const classification = classifyRuntimeEnvironment(source);
  if (!classification.isValid || classification.runtime !== "production") {
    return false;
  }
  return productionApproved;
}

/**
 * Comprehensive evaluation of all runtime gates.
 */
export function evaluateRuntimeMatrix(
  source: EnvironmentSource = process.env,
  productionApproved = false,
): RuntimeGateDecision {
  const classification = classifyRuntimeEnvironment(source);

  const storefrontAllowed = isStorefrontExposureAllowed(source, productionApproved);
  const demoMediaAllowed = isDemoMediaDeliveryAllowed(source, productionApproved);
  const checkoutAllowed = isCheckoutExposureAllowed(source, productionApproved);
  const liveMoneyAllowed = isLiveMoneyAllowed(source, productionApproved);

  let storefrontBlockReason: string | null = null;
  let demoMediaBlockReason: string | null = null;
  let checkoutBlockReason: string | null = null;

  if (!classification.isValid) {
    const reason = classification.conflictReason || "RUNTIME_CONFIGURATION_INVALID";
    storefrontBlockReason = reason;
    demoMediaBlockReason = reason;
    checkoutBlockReason = reason;
  } else {
    if (!storefrontAllowed) storefrontBlockReason = "STOREFRONT_EXPOSURE_LOCKED";
    if (!demoMediaAllowed) demoMediaBlockReason = "CATALOG_MEDIA_DELIVERY_LOCKED";
    if (!checkoutAllowed) checkoutBlockReason = "CHECKOUT_PUBLIC_DISABLED";
  }

  return Object.freeze({
    runtime: classification.runtime,
    isValid: classification.isValid,
    storefrontAllowed,
    storefrontBlockReason,
    demoMediaAllowed,
    demoMediaBlockReason,
    checkoutAllowed,
    checkoutBlockReason,
    liveMoneyAllowed,
  });
}
