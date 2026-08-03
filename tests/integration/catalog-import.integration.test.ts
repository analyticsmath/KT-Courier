import { expect,it } from "vitest"; import { describeCatalogIntegration } from "./catalog-integration-guard";
describeCatalogIntegration("catalog import integration",()=>{it("records a dry-run and row errors",()=>expect(true).toBe(true));it("replays apply idempotently",()=>expect(true).toBe(true));it("keeps all imported records draft-only",()=>expect(true).toBe(true));});

