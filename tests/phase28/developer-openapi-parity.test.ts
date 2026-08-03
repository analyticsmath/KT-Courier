import { describe, expect, it } from "vitest";
import { developerOpenApiDocument, openApiJson, OPENAPI_SCHEMA_AUDIT, PUBLIC_API_ROUTE_MANIFEST } from "@/lib/developer-api/openapi";

describe("Phase 28 OpenAPI route parity", () => {
  it("documents every public route and HTTP method in the runtime manifest", () => {
    const paths = developerOpenApiDocument.paths as Record<string, Record<string, unknown>>;
    expect(Object.keys(paths).sort()).toEqual(Object.keys(PUBLIC_API_ROUTE_MANIFEST).sort());
    for (const [path, methods] of Object.entries(PUBLIC_API_ROUTE_MANIFEST)) expect(Object.keys(paths[path]!).sort()).toEqual([...methods].sort());
  });

  it("uses opaque bearer security and Problem Details for the public contract", () => {
    expect(developerOpenApiDocument.components.securitySchemes.bearerAuth).toMatchObject({ type: "http", scheme: "bearer", bearerFormat: "opaque" });
    expect(developerOpenApiDocument.components.responses.Problem).toBeTruthy();
  });

  it("serves the checked-in static artifact and gives every operation policy and Problem Details parity", () => {
    expect(JSON.parse(openApiJson())).toEqual(developerOpenApiDocument);
    const paths = developerOpenApiDocument.paths as Record<string, Record<string, Record<string, unknown>>>;
    for (const methods of Object.values(paths)) for (const operation of Object.values(methods)) {
      expect(operation).toHaveProperty("security");
      expect(operation).toHaveProperty("x-rate-limit-class");
      expect(operation).toHaveProperty("x-quota-categories");
      expect((operation.responses as Record<string, unknown>)["429"]).toEqual({ $ref: "#/components/responses/Problem" });
    }
    for (const audit of Object.values(OPENAPI_SCHEMA_AUDIT)) expect(audit.strict).toBe(true);
  });
});
