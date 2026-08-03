export class CatalogPolicyError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 422,
  ) {
    super(message);
    this.name = "CatalogPolicyError";
  }
}

export class CatalogConflictError extends CatalogPolicyError {
  constructor(code: string, message: string) {
    super(code, message, 409);
    this.name = "CatalogConflictError";
  }
}

export class CatalogNotFoundError extends CatalogPolicyError {
  constructor(message = "Catalog record was not found.") {
    super("CATALOG_NOT_FOUND", message, 404);
    this.name = "CatalogNotFoundError";
  }
}

export class CatalogOwnershipError extends CatalogPolicyError {
  constructor() {
    super("CATALOG_OWNERSHIP_DENIED", "The catalog record does not belong to this store.", 403);
    this.name = "CatalogOwnershipError";
  }
}

