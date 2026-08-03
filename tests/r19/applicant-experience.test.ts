import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getApplicantStatus } from "@/lib/applicant-presentation/applicant-status";
const source=(p:string)=>readFileSync(join(process.cwd(),p),"utf8");
const root="app/(applicant)/applicant";
describe("R19 applicant boundary",()=>{
 it("keeps every verified applicant path under the dedicated dossier boundary",()=>{for(const page of ["page.tsx","applications/page.tsx","applications/new/[openingReference]/page.tsx","applications/[reference]/page.tsx","applications/[reference]/documents/page.tsx","applications/[reference]/interviews/page.tsx","applications/[reference]/offer/page.tsx","profile/page.tsx","privacy/page.tsx","data-requests/page.tsx","notifications/page.tsx"])expect(existsSync(join(process.cwd(),root,page))).toBe(true);const layout=source(`${root}/layout.tsx`);expect(layout).toContain("CandidateDossierShell");expect(layout).toContain("requireAuth");expect(layout).not.toContain("EditorialOperationsShell");});
 it("keeps applicant routes noindex and without browser persistence",()=>{expect(source(`${root}/layout.tsx`)).toContain("index: false");const files=["page.tsx","applications/page.tsx","profile/page.tsx","privacy/page.tsx"];for(const file of files){const value=source(`${root}/${file}`);expect(value).not.toContain("localStorage");expect(value).not.toContain("sessionStorage");expect(value).not.toContain('"use client"');}});
 it("uses a neutral fallback for unknown lifecycle state",()=>{expect(getApplicantStatus("UNKNOWN").label).toBe("Status update unavailable");expect(getApplicantStatus("UNKNOWN").tone).toBe("neutral");expect(getApplicantStatus("OFFERED").label).toBe("Offer available");});
 it("does not retain the fixture form, document reference, or client-side offer mutation",()=>{for(const file of ["applications/[reference]/questions/page.tsx","applications/[reference]/documents/page.tsx","applications/[reference]/offer/page.tsx"]){const value=source(`${root}/${file}`);expect(value).not.toContain("MEDIA-");expect(value).not.toContain("years_experience");expect(value).not.toContain("setOffer(");}});
});
