import { expect, it } from "vitest";
import { disposableBrowserCatalogMediaAllowed } from "@/lib/catalog/media/disposable-catalog-media-policy";
const fixture = { NODE_ENV: "test", KT_RUNTIME_ENV: "e2e", KT_NETWORK_DISABLED: "true", CATALOG_MEDIA_STORAGE: "filesystem", CATALOG_MEDIA_LOCAL_DIR: "/tmp/kt-couriers-e2e-catalog-media", DATABASE_URL: "postgresql://kt_phase75_e2e:disposable@db:5432/kt_phase75_e2e" };
it("admits only the named network-isolated browser database", () => expect(disposableBrowserCatalogMediaAllowed(fixture)).toBe(true));
it.each([
  { NODE_ENV: "production" }, { KT_DATABASE_CLASSIFICATION: "production" }, { KT_NETWORK_DISABLED: "false" },
  { DATABASE_URL: "postgresql://kt_phase75_e2e:disposable@remote.example/kt_phase75_e2e" },
  { DATABASE_URL: "postgresql://kt_phase75_e2e:disposable@db/kt_courier" },
  { DATABASE_URL: "postgresql://wrong:disposable@db/kt_phase75_e2e" },
  { CATALOG_MEDIA_LOCAL_DIR: "/app/public" },
])("refuses a production, remote or unisolated adapter source %j", changes => expect(disposableBrowserCatalogMediaAllowed({ ...fixture, ...changes })).toBe(false));
