import { describe, expect, it } from "vitest";
import { ManagedCommerceError } from "@/lib/super-admin/commerce.service";
import { signupTransactionFailureResponse } from "@/lib/auth/signup-failure";

describe("vendor invite signup failure feedback", () => {
  it("reports expired or previously claimed invitations without blaming email delivery", async () => {
    const result = signupTransactionFailureResponse(new ManagedCommerceError("STORE_INVITATION_INVALID", "Invitation expired", 409));
    expect(result.status).toBe(409);
    expect(await result.json()).toEqual({ code: "STORE_INVITATION_INVALID", error: "The store invitation has expired, is invalid or was already used. Ask for a new invitation link." });
  });
  it("retains ACCOUNT_EMAIL_UNAVAILABLE only for a failure during encrypted notification persistence", async () => {
    const failure=signupTransactionFailureResponse(new Error("SQL insert into secure payload rejected"), { securityEmailQueueFailed:true });
    expect(failure.status).toBe(503);
    expect(await failure.json()).toMatchObject({ code: "ACCOUNT_EMAIL_UNAVAILABLE" });
    const other=signupTransactionFailureResponse(new Error("SQL insert into user rejected"), { securityEmailQueueFailed:false });
    expect(await other.json()).toMatchObject({code:"ACCOUNT_CREATION_UNAVAILABLE"});
  });
  it("does not reveal database/SQL details when registration fails", async () => {
    const result=signupTransactionFailureResponse(new Error("postgres internal error: auth password"));
    expect(result.status).toBe(503);
    const body=await result.json();
    expect(body.code).toBe("ACCOUNT_CREATION_UNAVAILABLE");
    expect(JSON.stringify(body)).not.toMatch(/postgres|password|email provider/i);
  });
});
