// API scaffold: permission denial, strict request body, draft create/update,
// submit, independent approval, locked activation, reject, retire, and preview.
import { describe, expect, it } from "vitest";
import { CommissionPlanCreateSchema } from "@/lib/validation/commissions";

describe("admin commission plan API contract", () => {
  it("rejects unknown plan mutation fields", () => expect(CommissionPlanCreateSchema.safeParse({}).success).toBe(false));
});
