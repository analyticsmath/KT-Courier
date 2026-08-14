import { readFileSync } from "node:fs"; import path from "node:path"; import { describe, expect, it } from "vitest";
const read=(file:string)=>readFileSync(path.join(process.cwd(),file),"utf8");
describe("managed marketing package and channel authority",()=>{
 it("models versioned commercial package metadata and extensible channel definitions",()=>{const schema=read("prisma/schema.prisma"),migration=read("prisma/migrations/20260811172000_phase_b_managed_marketing_package_channel_authority/migration.sql");expect(schema).toMatch(/model ManagedMarketingChannelDefinition/);expect(schema).toMatch(/model ManagedMarketingPackageChannel/);expect(schema).toMatch(/estimatedReachMetadata/);expect(migration).toMatch(/ManagedMarketingPackageVersion_non_negative/);expect(migration).toMatch(/package_channel_key/);});
 it("validates channel relationships and preserves version-bound commercial configuration",()=>{const service=read("lib/advertising/managed-marketing.service.ts");expect(service).toMatch(/MARKETING_CHANNEL_NOT_ALLOWED/);expect(service).toMatch(/versionNumber/);expect(service).toMatch(/priceAmount/);expect(service).toMatch(/retirePackage/);});
});
