import { describe } from "vitest";
export const catalogIntegrationEnabled = !!process.env.DATABASE_URL;
export const describeCatalogIntegration = catalogIntegrationEnabled ? describe : describe.skip;
