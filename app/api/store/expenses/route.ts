import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  ExpenseQuerySchema,
  storeExpenses,
  expenseCsv,
} from "@/lib/client-platform/expenses.service";
import { json, failure } from "@/lib/client-platform/api";
export async function GET(req: NextRequest) {
  const u = await getCurrentUser();
  if (!u) return json({ error: "Sign in to continue." }, 401);
  const query = Object.fromEntries(req.nextUrl.searchParams),
    format = query.format;
  delete query.format;
  if (format && format !== "csv")
    return json({ error: "Unsupported export format." }, 422);
  const p = ExpenseQuerySchema.safeParse(query);
  if (!p.success) return json({ error: "Choose valid expense filters." }, 422);
  try {
    const result = await storeExpenses(u.id, p.data);
    if (format === "csv")
      return new Response(expenseCsv(result.rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="kt-expenses-${result.filters.from}-${result.filters.to}.csv"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    return json({
      ...result,
      rows: result.rows.slice((p.data.page - 1) * 100, p.data.page * 100),
    });
  } catch (e) {
    return failure(e);
  }
}
