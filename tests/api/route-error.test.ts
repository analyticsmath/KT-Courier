import { describe, expect, it } from "vitest";
import { apiRouteError } from "@/lib/api/route-error";

class CatalogRouteError extends Error {
  readonly code = "CATALOG_MEDIA_UNAVAILABLE";
}

describe("apiRouteError", () => {
  it("maps a validated own domain code without exposing unknown failures", async () => {
    const known = apiRouteError(new CatalogRouteError("Media is unavailable."), {
      fallbackMessage: "Request failed.",
    });
    const unknown = apiRouteError(new Error("internal detail"), {
      fallbackMessage: "Request failed.",
    });

    expect(known.status).toBe(400);
    await expect(known.json()).resolves.toEqual({ error: "Media is unavailable." });
    expect(unknown.status).toBe(500);
    await expect(unknown.json()).resolves.toEqual({ error: "Request failed." });
  });
});
