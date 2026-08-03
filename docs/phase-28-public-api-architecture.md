# Phase 28 public API architecture

`/api/v1` authenticates an opaque credential, resolves its immutable scope grant and owner, applies usage policy, delegates to canonical business services, projects a safe DTO, and records a privacy-safe audit event. Public routes do not directly mutate business models.
