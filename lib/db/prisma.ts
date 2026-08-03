import { PrismaClient } from "@prisma/client";

// Prevent multiple PrismaClient instances during Next.js development hot reload.
// In production a single instance is created at module load time.

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
