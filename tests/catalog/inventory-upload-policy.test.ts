import { describe, expect, it } from "vitest";
import { INVENTORY_UPLOAD_HEADER, parseInventoryUpload } from "@/lib/catalog/inventory-upload-policy";
describe("bounded whole-unit stock receipt CSV", () => {
  it("parses BOM and CRLF without changing exact references or quantities", () => { expect(parseInventoryUpload(`\uFEFF${INVENTORY_UPLOAD_HEADER}\r\nCI-1234,IL-1234,1,3\r\n`)).toEqual([{ inventoryReference: "CI-1234", locationReference: "IL-1234", version: 1, quantity: 3 }]); });
  it.each(["CI-1234,IL-1234,1,0", "CI-1234,IL-1234,1,-1", "CI-1234,IL-1234,1,0.5", "=formula,IL-1234,1,1", "CI-1234,IL-1234,1,2147483648", "CI-1234,IL-1234,1,1\nCI-1234,IL-2345,1,2"])("refuses invalid or duplicate rows %s", row => { expect(() => parseInventoryUpload(`${INVENTORY_UPLOAD_HEADER}\n${row}`)).toThrow(); });
  it("rejects empty, excessive and oversized files", () => { for (const value of [INVENTORY_UPLOAD_HEADER, `${INVENTORY_UPLOAD_HEADER}\n${"x".repeat(64_000)}`, `${INVENTORY_UPLOAD_HEADER}\n${Array.from({ length: 101 }, (_, i) => `CI-${i}000,IL-1234,1,1`).join("\n")}`]) expect(() => parseInventoryUpload(value)).toThrow(); });
});
