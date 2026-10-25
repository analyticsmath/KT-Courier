import { describe, expect, it } from "vitest";
import { InvitationDraftSchema, verifyStoreInvitationClaim } from "@/lib/super-admin/store-invitation";
const input={ email:"owner@example.com",storeName:"Green Basket Grocers",contactName:"Business Owner" };
describe("Super Admin store invitation policy",()=>{
 it("accepts safe vendor invitations",()=>{expect(InvitationDraftSchema.safeParse(input).success).toBe(true);});
 it("rejects injected names, ambiguous email and empty store name",()=>{
  expect(InvitationDraftSchema.safeParse({...input,storeName:"<script>test</script>"}).success).toBe(false);
  expect(InvitationDraftSchema.safeParse({...input,email:"bad"}).success).toBe(false);
 });
 it("requires a matching email/store and unclaimed unexpired token",()=>{
  const invitation={...input,status:"PENDING",expiresAt:new Date("2026-11-01T00:00:00Z")};
  expect(()=>verifyStoreInvitationClaim(invitation,input,new Date("2026-10-25T00:00:00Z"))).not.toThrow();
  expect(()=>verifyStoreInvitationClaim({...invitation,status:"CLAIMED"},input,new Date("2026-10-25T00:00:00Z"))).toThrow();
  expect(()=>verifyStoreInvitationClaim(invitation,{...input,email:"different@example.com"},new Date("2026-10-25T00:00:00Z"))).toThrow();
  expect(()=>verifyStoreInvitationClaim(invitation,input,new Date("2026-11-02T00:00:00Z"))).toThrow();
 });
});
