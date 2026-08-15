import { describe, it, expect } from "vitest";
import {
  CustomerSignupSchema,
  StoreSignupSchema,
  ResetPasswordSchema,
  LoginSchema,
  isBcryptByteLengthValid,
} from "../../lib/validation/auth";
import { AdminEmployeeCreateSchema } from "../../lib/validation/admin-employees";
import { hashPassword, verifyPassword } from "../../lib/auth/password";

describe("P1R-007: Password Bcrypt Byte-Length Boundary in Validation Layer", () => {
  it("1: 72 ASCII characters (= exactly 72 bytes) pass validation and hash safely", async () => {
    const valid72Ascii = "A".repeat(72);
    expect(Buffer.byteLength(valid72Ascii, "utf8")).toBe(72);
    expect(isBcryptByteLengthValid(valid72Ascii)).toBe(true);

    const signupParsed = CustomerSignupSchema.safeParse({
      fullName: "Test User",
      email: "user72@example.com",
      password: valid72Ascii,
      confirmPassword: valid72Ascii,
      accountType: "CUSTOMER",
    });
    expect(signupParsed.success).toBe(true);

    const hash = await hashPassword(valid72Ascii);
    expect(typeof hash).toBe("string");
    expect(await verifyPassword(valid72Ascii, hash)).toBe(true);
  });

  it("2: 73 ASCII characters (= 73 bytes) fail validation before reaching hash layer", async () => {
    const invalid73Ascii = "A".repeat(73);
    expect(Buffer.byteLength(invalid73Ascii, "utf8")).toBe(73);
    expect(isBcryptByteLengthValid(invalid73Ascii)).toBe(false);

    const signupParsed = CustomerSignupSchema.safeParse({
      fullName: "Test User",
      email: "user73@example.com",
      password: invalid73Ascii,
      confirmPassword: invalid73Ascii,
      accountType: "CUSTOMER",
    });
    expect(signupParsed.success).toBe(false);
    if (!signupParsed.success) {
      expect(signupParsed.error.issues[0].message).toContain("72 bytes");
    }

    // Downstream defense in depth also throws if bypassed
    await expect(hashPassword(invalid73Ascii)).rejects.toThrow("72 bytes");
  });

  it("3: 18 four-byte UTF-8 emojis (= exactly 72 bytes, 18 or 36 JS chars) pass validation", async () => {
    // '🔐' is 4 bytes in UTF-8
    const emoji = "🔐";
    expect(Buffer.byteLength(emoji, "utf8")).toBe(4);

    const valid72Multibyte = emoji.repeat(18); // 18 * 4 = 72 bytes
    expect(Buffer.byteLength(valid72Multibyte, "utf8")).toBe(72);
    expect(isBcryptByteLengthValid(valid72Multibyte)).toBe(true);

    const loginParsed = LoginSchema.safeParse({
      email: "emoji72@example.com",
      password: valid72Multibyte,
    });
    expect(loginParsed.success).toBe(true);

    const storeSignupParsed = StoreSignupSchema.safeParse({
      storeName: "Emoji Store",
      contactPerson: "Emoji Owner",
      email: "store72@example.com",
      phone: "+27821234567",
      password: valid72Multibyte,
      confirmPassword: valid72Multibyte,
      accountType: "STORE",
    });
    expect(storeSignupParsed.success).toBe(true);

    const hash = await hashPassword(valid72Multibyte);
    expect(await verifyPassword(valid72Multibyte, hash)).toBe(true);
  });

  it("4: 19 four-byte UTF-8 emojis (= 76 bytes, though only 19 glyphs) fail validation", async () => {
    const emoji = "🔐";
    const invalid76Multibyte = emoji.repeat(19); // 19 * 4 = 76 bytes
    expect(Buffer.byteLength(invalid76Multibyte, "utf8")).toBe(76);
    expect(isBcryptByteLengthValid(invalid76Multibyte)).toBe(false);

    const resetParsed = ResetPasswordSchema.safeParse({
      token: "valid-reset-token-123",
      password: invalid76Multibyte,
      confirmPassword: invalid76Multibyte,
    });
    expect(resetParsed.success).toBe(false);
    if (!resetParsed.success) {
      expect(resetParsed.error.issues[0].message).toContain("72 bytes");
    }
  });

  it("5: Multibyte mixed characters (Afrikaans, Cyrillic, CJK, Emoji) are measured accurately by UTF-8 bytes", () => {
    // "Wêreld🔐" -> W(1) + ê(2) + r(1) + e(1) + l(1) + d(1) + 🔐(4) = 11 bytes
    const mixed = "Wêreld🔐";
    expect(Buffer.byteLength(mixed, "utf8")).toBe(11);

    // Construct exactly 72 bytes from mixed
    // 6 * 11 = 66 bytes + 6 ASCII chars = 72 bytes
    const exactly72Mixed = mixed.repeat(6) + "ABCDEF";
    expect(Buffer.byteLength(exactly72Mixed, "utf8")).toBe(72);
    expect(isBcryptByteLengthValid(exactly72Mixed)).toBe(true);

    const parsed72 = LoginSchema.safeParse({
      email: "mixed@example.com",
      password: exactly72Mixed,
    });
    expect(parsed72.success).toBe(true);

    // Add 1 ASCII byte -> 73 bytes
    const exactly73Mixed = exactly72Mixed + "X";
    expect(Buffer.byteLength(exactly73Mixed, "utf8")).toBe(73);
    expect(isBcryptByteLengthValid(exactly73Mixed)).toBe(false);

    const parsed73 = LoginSchema.safeParse({
      email: "mixed@example.com",
      password: exactly73Mixed,
    });
    expect(parsed73.success).toBe(false);
  });

  it("6: Admin employee create schema enforces 72-byte max on password", () => {
    const validPassword = "SafeAdminPassword123!@#";
    const validParsed = AdminEmployeeCreateSchema.safeParse({
      email: "admin@example.com",
      password: validPassword,
      name: "Admin User",
    });
    expect(validParsed.success).toBe(true);

    const invalid73Password = "B".repeat(73);
    const invalidParsed = AdminEmployeeCreateSchema.safeParse({
      email: "admin@example.com",
      password: invalid73Password,
      name: "Admin User",
    });
    expect(invalidParsed.success).toBe(false);
    if (!invalidParsed.success) {
      expect(invalidParsed.error.issues[0].message).toContain("72 bytes");
    }
  });
});
