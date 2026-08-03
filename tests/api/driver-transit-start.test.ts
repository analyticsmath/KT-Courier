import { describe, expect, it } from "vitest";
import { StartDeliverySchema } from "@/lib/validation/delivery";
describe("transit start API contract", () => { it("rejects missing command concurrency fields", () => { expect(StartDeliverySchema.safeParse({}).success).toBe(false); }); });
