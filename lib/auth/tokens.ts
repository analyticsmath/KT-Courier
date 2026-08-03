import crypto from "node:crypto";

export function generateToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateResetTokenExpiresAt(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1); // 1 hour
  return d;
}
