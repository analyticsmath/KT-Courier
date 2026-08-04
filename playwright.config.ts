import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3200",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? "chrome" },
      testMatch: [
        /storefront-browsing\.spec\.ts/,
        /marketplace-cart\.spec\.ts/,
        /marketplace-checkout-guest\.spec\.ts/,
      ],
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"], channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? "chrome" },
      testMatch: [/mobile-viewport\.spec\.ts/],
    },
    {
      name: "keyboard",
      use: { ...devices["Desktop Chrome"], channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? "chrome" },
      testMatch: [/keyboard-navigation\.spec\.ts/],
    },
  ],
});
