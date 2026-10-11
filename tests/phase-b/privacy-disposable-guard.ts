import { prisma } from "@/lib/db/prisma";

export async function assertPrivacyDisposableDatabase() {
  const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
  if (process.env.NODE_ENV === "production" || process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1" || process.env.KT_NETWORK_DISABLED !== "true" || !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/kt_launch_test" || url.username !== "kt_closure_test") throw new Error("Privacy acceptance requires the named isolated closure database and disabled egress.");
  const [identity] = await prisma.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database() AS database, current_user AS role`;
  if (identity?.database !== "kt_launch_test" || identity.role !== "kt_closure_test") throw new Error("Privacy acceptance database identity mismatch.");
}
