import { expect, it, vi } from "vitest";
const findMany = vi.hoisted(() => vi.fn().mockResolvedValue([]));
vi.mock("@/lib/db/prisma", () => ({ prisma: { catalogModerationCase: { findMany } } }));
import { listCatalogModerationCases } from "@/lib/services/catalog-moderation.service";
it("selects only unresolved cases before limiting the attention queue", async () => {
  await listCatalogModerationCases({ needsAttention: true });
  expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { status: { in: ["OPEN", "UNDER_REVIEW", "NEEDS_CHANGES"] } }, orderBy: [{ priority: "desc" }, { openedAt: "asc" }] }));
});
it("retains unfiltered history and explicit status filtering", async () => {
  await listCatalogModerationCases();
  expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: undefined }));
  await listCatalogModerationCases({ status: "APPROVED" });
  expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { status: "APPROVED" } }));
});
