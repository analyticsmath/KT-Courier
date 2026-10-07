import { afterEach, describe, expect, it, vi } from "vitest";
import { disposableBrowserPrivateMediaAllowed } from "@/lib/private-media/disposable-private-media-policy";
import { createCloudinaryPrivateImageStorageAdapter } from "@/lib/private-media/cloudinary-private-image-storage";
import { LocalPrivateMediaStorageAdapter } from "@/lib/private-media/private-media-storage";
const isolated = { NODE_ENV: "test", KT_RUNTIME_ENV: "e2e", KT_NETWORK_DISABLED: "true", KT_E2E_PRIVATE_MEDIA_LOCAL: "true", PRIVATE_MEDIA_LOCAL_DIR: "/tmp/kt-couriers-e2e-private-media", DATABASE_URL: "postgresql://kt_phase75_e2e:disposable@db:5432/kt_phase75_e2e" };
afterEach(() => vi.unstubAllEnvs());
describe("local private raster adapter boundary", () => {
  it.each(["db", "localhost", "127.0.0.1"])("accepts only the isolated browser database on %s", host => {
    expect(disposableBrowserPrivateMediaAllowed({ ...isolated, DATABASE_URL: `postgresql://kt_phase75_e2e:disposable@${host}/kt_phase75_e2e` })).toBe(true);
  });
  it.each([
    ["NODE_ENV", "production"], ["NODE_ENV", "development"], ["KT_RUNTIME_ENV", "production"],
    ["KT_NETWORK_DISABLED", "false"], ["KT_E2E_PRIVATE_MEDIA_LOCAL", "false"],
    ["PRIVATE_MEDIA_LOCAL_DIR", "/app/public"], ["DATABASE_URL", "PRIVATE_DATABASE_DETAIL"],
    ["DATABASE_URL", "postgresql://kt_phase75_e2e:disposable@production.example/kt_phase75_e2e"],
    ["DATABASE_URL", "postgresql://kt_phase75_e2e:disposable@db/production"],
    ["DATABASE_URL", "postgresql://wrong:disposable@db/kt_phase75_e2e"],
    ["DATABASE_URL", "https://kt_phase75_e2e:disposable@db/kt_phase75_e2e"],
  ])("refuses unsafe %s without echoing rejected input", (key, value) => {
    expect(disposableBrowserPrivateMediaAllowed({ ...isolated, [key]: value })).toBe(false);
  });
  it("selects the actual local adapter in the approved disposable browser environment", () => {
    for (const [key, value] of Object.entries(isolated)) vi.stubEnv(key, value);
    expect(createCloudinaryPrivateImageStorageAdapter()).toBeInstanceOf(LocalPrivateMediaStorageAdapter);
  });
  it("production cannot select local storage even with every test flag supplied", () => {
    for (const [key, value] of Object.entries(isolated)) vi.stubEnv(key, value);
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("CLOUDINARY_URL", ""); vi.stubEnv("CLOUDINARY_CLOUD_NAME", ""); vi.stubEnv("CLOUDINARY_API_KEY", ""); vi.stubEnv("CLOUDINARY_API_SECRET", "");
    expect(() => createCloudinaryPrivateImageStorageAdapter()).toThrow("Cloudinary profile image uploads are not configured.");
  });
});
