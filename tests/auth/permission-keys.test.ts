import { describe, expect, it } from "vitest";
import {
  DEFAULT_ADMIN_PERMISSION_KEYS,
  PERMISSIONS,
  SYSTEM_PERMISSION_DEFINITIONS,
} from "@/lib/auth/permission-keys";

describe("permission registry", () => {
  it("defines every permission key in the system registry", () => {
    const definedKeys = new Set(
      SYSTEM_PERMISSION_DEFINITIONS.map((permission) => permission.key)
    );

    for (const key of Object.values(PERMISSIONS)) {
      expect(definedKeys.has(key)).toBe(true);
    }
  });

  it("does not contain duplicate permission keys", () => {
    const keys = SYSTEM_PERMISSION_DEFINITIONS.map((permission) => permission.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps required permission definition fields populated", () => {
    for (const definition of SYSTEM_PERMISSION_DEFINITIONS) {
      expect(definition.key.trim()).not.toBe("");
      expect(definition.name.trim()).not.toBe("");
      expect(definition.category.trim()).not.toBe("");
    }
  });

  it("keeps default ADMIN grants known and excludes high-risk permissions", () => {
    const knownKeys = new Set(Object.values(PERMISSIONS));
    for (const key of DEFAULT_ADMIN_PERMISSION_KEYS) {
      expect(knownKeys.has(key)).toBe(true);
    }

    expect(DEFAULT_ADMIN_PERMISSION_KEYS).not.toContain(PERMISSIONS.EMPLOYEES_CREATE);
    expect(DEFAULT_ADMIN_PERMISSION_KEYS).not.toContain(
      PERMISSIONS.EMPLOYEES_PERMISSIONS_MANAGE
    );
    expect(DEFAULT_ADMIN_PERMISSION_KEYS).not.toContain(PERMISSIONS.SETTINGS_UPDATE);
    expect(DEFAULT_ADMIN_PERMISSION_KEYS).not.toContain(PERMISSIONS.USERS_SUSPEND);
    expect(DEFAULT_ADMIN_PERMISSION_KEYS).not.toContain(PERMISSIONS.FINANCE_READ);
    expect(DEFAULT_ADMIN_PERMISSION_KEYS).toContain(PERMISSIONS.LEDGER_READ);
    expect(DEFAULT_ADMIN_PERMISSION_KEYS).not.toContain(PERMISSIONS.REPORTS_EXPORT);
  });
});
