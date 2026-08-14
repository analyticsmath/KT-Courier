import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export const MAX_PASSWORD_BYTES = 72;

export function isPasswordByteLengthValid(plaintext: string): boolean {
  return Buffer.byteLength(plaintext, "utf8") <= MAX_PASSWORD_BYTES;
}

export async function hashPassword(plaintext: string): Promise<string> {
  if (!isPasswordByteLengthValid(plaintext)) {
    throw new Error("Password exceeds maximum supported length (72 bytes).");
  }
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

export async function verifyPassword(
  plaintext: string,
  hash: string
): Promise<boolean> {
  if (!isPasswordByteLengthValid(plaintext)) {
    return false;
  }
  return bcrypt.compare(plaintext, hash);
}
