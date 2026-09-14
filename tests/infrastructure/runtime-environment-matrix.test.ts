import { describe, it, expect } from "vitest";
import {
  classifyRuntimeEnvironment,
  isStorefrontExposureAllowed,
  isDemoMediaDeliveryAllowed,
  isCheckoutExposureAllowed,
  isLiveMoneyAllowed,
  evaluateRuntimeMatrix,
} from "@/lib/runtime/deployment-classification";

describe("Runtime Environment Classification & Precedence Matrix", () => {
  describe("Canonical Environment Classification", () => {
    it("classifies local-demo when unconfigured development", () => {
      const res = classifyRuntimeEnvironment({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/kt_courier_disposable",
      });
      expect(res.runtime).toBe("local-demo");
      expect(res.isValid).toBe(true);
      expect(res.isLocalDemo).toBe(true);
      expect(res.isStagingDemo).toBe(false);
      expect(res.isProductionBuild).toBe(false);
    });

    it("classifies test environment under CI / test harnesses", () => {
      const res = classifyRuntimeEnvironment({
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/kt_courier_test",
      });
      expect(res.runtime).toBe("test");
      expect(res.isValid).toBe(true);
      expect(res.isTest).toBe(true);
    });

    it("classifies staging-demo with production Next build and valid staging markers", () => {
      const res = classifyRuntimeEnvironment({
        NODE_ENV: "production",
        KT_RUNTIME_ENV: "staging-demo",
        KT_STAGING_DEMO_ENABLED: "true",
        KT_DATABASE_CLASSIFICATION: "staging",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/kt_courier_staging_demo",
      });
      expect(res.runtime).toBe("staging-demo");
      expect(res.isValid).toBe(true);
      expect(res.isStagingDemo).toBe(true);
      expect(res.isProductionBuild).toBe(true);
      expect(res.conflictReason).toBeNull();
    });

    it("classifies production under production markers", () => {
      const res = classifyRuntimeEnvironment({
        NODE_ENV: "production",
        KT_RUNTIME_ENV: "production",
        KT_DATABASE_CLASSIFICATION: "production",
        DATABASE_URL: "postgresql://postgres:secret@db.ktcourier.internal:5432/kt_courier_live",
      });
      expect(res.runtime).toBe("production");
      expect(res.isValid).toBe(true);
      expect(res.isProductionBuild).toBe(true);
      expect(res.isStagingDemo).toBe(false);
    });
  });

  describe("Production Precedence & Fail-Closed Contradictory States", () => {
    it("fails closed if staging runtime points to a production-marked database host", () => {
      const res = classifyRuntimeEnvironment({
        NODE_ENV: "production",
        KT_RUNTIME_ENV: "staging-demo",
        KT_STAGING_DEMO_ENABLED: "true",
        DATABASE_URL: "postgresql://postgres:pass@rds.amazonaws.com:5432/kt_courier_prod",
      });
      expect(res.isValid).toBe(false);
      expect(res.conflictReason).toBe("CONTRADICTORY_PRODUCTION_DATABASE_WITH_STAGING_FLAG");
    });

    it("fails closed if staging runtime points to primary production database name", () => {
      const res = classifyRuntimeEnvironment({
        NODE_ENV: "production",
        KT_RUNTIME_ENV: "staging-demo",
        KT_STAGING_DEMO_ENABLED: "true",
        DATABASE_URL: "postgresql://postgres:pass@localhost:5432/kt_courier",
      });
      expect(res.isValid).toBe(false);
      expect(res.conflictReason).toBe("CONTRADICTORY_PRODUCTION_DATABASE_WITH_STAGING_FLAG");
    });

    it("fails closed if staging demo flag is present in production without KT_RUNTIME_ENV=staging-demo", () => {
      const res = classifyRuntimeEnvironment({
        NODE_ENV: "production",
        KT_STAGING_DEMO_ENABLED: "true",
        DATABASE_URL: "postgresql://postgres:pass@localhost:5432/kt_courier_staging_demo",
      });
      expect(res.isValid).toBe(false);
      expect(res.conflictReason).toBe("STAGING_FLAG_PRESENT_WITHOUT_STAGING_RUNTIME_ENV_IN_PRODUCTION");
    });

    it("fails closed if test points to a production database", () => {
      const res = classifyRuntimeEnvironment({
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://postgres:pass@rds.amazonaws.com:5432/kt_courier_test",
      });
      expect(res.isValid).toBe(false);
      expect(res.conflictReason).toBe("DATABASE_CLASSIFIED_PRODUCTION_DURING_TEST");
    });

    it("fails closed if KT_DATABASE_CLASSIFICATION contradicts staging runtime", () => {
      const res = classifyRuntimeEnvironment({
        NODE_ENV: "production",
        KT_RUNTIME_ENV: "staging-demo",
        KT_STAGING_DEMO_ENABLED: "true",
        KT_DATABASE_CLASSIFICATION: "production",
        DATABASE_URL: "postgresql://postgres:pass@localhost:5432/kt_courier_staging_demo",
      });
      expect(res.isValid).toBe(false);
      expect(res.conflictReason).toBe("CONTRADICTORY_PRODUCTION_DATABASE_WITH_STAGING_FLAG");
    });
  });

  describe("Security Gate Evaluations", () => {
    it("keeps storefront locked in unconfigured production even if staging flag is set", () => {
      const env = {
        NODE_ENV: "production",
        KT_RUNTIME_ENV: "production",
        KT_STAGING_DEMO_ENABLED: "true",
        DATABASE_URL: "postgresql://postgres:pass@localhost:5432/kt_courier_disposable",
      };
      expect(isStorefrontExposureAllowed(env, false)).toBe(false);
    });

    it("allows storefront in staging-demo when properly configured", () => {
      const env = {
        NODE_ENV: "production",
        KT_RUNTIME_ENV: "staging-demo",
        KT_STAGING_DEMO_ENABLED: "true",
        DATABASE_URL: "postgresql://postgres:pass@localhost:5432/kt_courier_staging_demo",
      };
      expect(isStorefrontExposureAllowed(env, false)).toBe(true);
    });

    it("keeps demo media delivery locked in unconfigured production even if CATALOG_MEDIA_STORAGE=filesystem", () => {
      const env = {
        NODE_ENV: "production",
        KT_RUNTIME_ENV: "production",
        CATALOG_MEDIA_STORAGE: "filesystem",
        DATABASE_URL: "postgresql://postgres:pass@localhost:5432/kt_courier_disposable",
      };
      expect(isDemoMediaDeliveryAllowed(env, false)).toBe(false);
    });

    it("allows demo media delivery in staging-demo with KT_STAGING_DEMO_ENABLED", () => {
      const env = {
        NODE_ENV: "production",
        KT_RUNTIME_ENV: "staging-demo",
        KT_STAGING_DEMO_ENABLED: "true",
        DATABASE_URL: "postgresql://postgres:pass@localhost:5432/kt_courier_staging_demo",
      };
      expect(isDemoMediaDeliveryAllowed(env, false)).toBe(true);
    });

    it("keeps checkout locked unless CHECKOUT_PUBLIC_ENABLED is true", () => {
      const stagingWithoutCheckout = {
        NODE_ENV: "production",
        KT_RUNTIME_ENV: "staging-demo",
        KT_STAGING_DEMO_ENABLED: "true",
        DATABASE_URL: "postgresql://postgres:pass@localhost:5432/kt_courier_staging_demo",
      };
      expect(isCheckoutExposureAllowed(stagingWithoutCheckout, false)).toBe(false);

      const stagingWithCheckout = {
        ...stagingWithoutCheckout,
        CHECKOUT_PUBLIC_ENABLED: "true",
      };
      expect(isCheckoutExposureAllowed(stagingWithCheckout, false)).toBe(true);
    });

    it("strictly forbids live money in local-demo, test, and staging-demo", () => {
      expect(isLiveMoneyAllowed({ NODE_ENV: "development" }, false)).toBe(false);
      expect(isLiveMoneyAllowed({ NODE_ENV: "test" }, false)).toBe(false);
      expect(
        isLiveMoneyAllowed(
          {
            NODE_ENV: "production",
            KT_RUNTIME_ENV: "staging-demo",
            KT_STAGING_DEMO_ENABLED: "true",
            DATABASE_URL: "postgresql://postgres:pass@localhost:5432/kt_courier_staging_demo",
          },
          false,
        ),
      ).toBe(false);
    });

    it("evaluates consolidated gates consistently", () => {
      const decision = evaluateRuntimeMatrix(
        {
          NODE_ENV: "production",
          KT_RUNTIME_ENV: "staging-demo",
          KT_STAGING_DEMO_ENABLED: "true",
          CHECKOUT_PUBLIC_ENABLED: "true",
          DATABASE_URL: "postgresql://postgres:pass@localhost:5432/kt_courier_staging_demo",
        },
        false,
      );
      expect(decision.runtime).toBe("staging-demo");
      expect(decision.isValid).toBe(true);
      expect(decision.storefrontAllowed).toBe(true);
      expect(decision.demoMediaAllowed).toBe(true);
      expect(decision.checkoutAllowed).toBe(true);
      expect(decision.liveMoneyAllowed).toBe(false);
    });
  });
});
