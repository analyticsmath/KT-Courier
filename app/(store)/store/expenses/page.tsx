import Link from "next/link";
import { requireBusinessPage } from "@/lib/client-platform/business-auth";
import {
  EXPENSE_TYPES,
  ExpenseQuerySchema,
  storeExpenses,
} from "@/lib/client-platform/expenses.service";
import {
  ProtectedPageFrame,
  ProtectedPageHeader,
  OperationalPanel,
} from "@/components/protected-v2";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
export const metadata = { title: "Business expenses" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const a = await requireBusinessPage("/store/expenses"),
    raw = await searchParams,
    parsed = ExpenseQuerySchema.safeParse(raw);
  if (!parsed.success)
    return (
      <ProtectedPageFrame>
        <ProtectedPageHeader
          title="Business expenses"
          description="Choose valid expense filters."
        />
        <Link href="/store/expenses">Reset filters</Link>
      </ProtectedPageFrame>
    );
  let data;
  try {
    data = await storeExpenses(a.user.id, parsed.data);
  } catch (e) {
    return (
      <ProtectedPageFrame>
        <ProtectedPageHeader
          title="Business expenses"
          description={e instanceof Error ? e.message : "Expenses unavailable."}
        />
        <Link href="/store/expenses">Reset filters</Link>
      </ProtectedPageFrame>
    );
  }
  const f = data.filters,
    page = f.page,
    query = new URLSearchParams({
      from: f.from,
      to: f.to,
      ...(f.type ? { type: f.type } : {}),
      ...(f.status ? { status: f.status } : {}),
    });
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Business finance"
        title="Expenses"
        description="Delivery charges, commission deductions, membership invoices, advertising and completed refund credits."
      />
      <OperationalPanel title="Filters">
        <form className="grid gap-4 sm:grid-cols-5" action="/store/expenses">
          <div>
            <Label htmlFor="expense-from">From</Label>
            <Input
              id="expense-from"
              name="from"
              type="date"
              defaultValue={f.from}
            />
          </div>
          <div>
            <Label htmlFor="expense-to">To</Label>
            <Input id="expense-to" name="to" type="date" defaultValue={f.to} />
          </div>
          <div>
            <Label htmlFor="expense-type">Type</Label>
            <select
              id="expense-type"
              name="type"
              defaultValue={f.type ?? ""}
              className="w-full min-h-12 border-b"
            >
              <option value="">All types</option>
              {EXPENSE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="expense-status">Status</Label>
            <select
              id="expense-status"
              name="status"
              defaultValue={f.status ?? ""}
              className="w-full min-h-12 border-b"
            >
              <option value="">All statuses</option>
              {[
                "PAID",
                "UNPAID",
                "PARTIAL",
                "DEDUCTED",
                "VOID",
                "REFUNDED",
                "OVERPAID",
              ].map((s) => (
                <option key={s} value={s}>
                  {s.toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button type="submit">Apply filters</Button>
          </div>
        </form>
      </OperationalPanel>
      <OperationalPanel
        title={`${data.count} matching records`}
        action={
          <Link
            href={`/api/store/expenses?${query}&format=csv`}
            className="inline-flex min-h-11 items-center border rounded-[var(--eo-radius-control)] px-4"
          >
            Export CSV
          </Link>
        }
      >
        <dl className="grid gap-5 sm:grid-cols-3">
          {Object.entries({
            "Recorded charges, net of credits": data.totals.recorded,
            "Paid or deducted, net of credits": data.totals.paid,
            Outstanding: data.totals.outstanding,
          }).map(([label, amount]) => (
            <div key={label}>
              <dt className="text-sm">{label}</dt>
              <dd className="mt-2 text-xl font-semibold">R {amount}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm">
          Amounts follow recorded charges. Unpaid amounts are not counted as
          paid. Refund credits are included only after completion.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  "Date",
                  "Type",
                  "Description / reference",
                  "Amount",
                  "Paid / deducted",
                  "Status",
                ].map((t) => (
                  <th key={t} className="py-3 pr-4 font-medium">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.slice((page - 1) * 100, page * 100).map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="py-4 pr-4 whitespace-nowrap">
                    {r.date.slice(0, 10)}
                  </td>
                  <td className="pr-4">{r.type.toLowerCase()}</td>
                  <td className="pr-4">
                    <p>{r.description}</p>
                    <p className="mt-1 text-xs">{r.reference}</p>
                  </td>
                  <td className="pr-4 whitespace-nowrap">R {r.amount}</td>
                  <td className="pr-4 whitespace-nowrap">R {r.paidAmount}</td>
                  <td>{r.status.toLowerCase()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.count && (
            <p className="py-5">No expense records for these filters.</p>
          )}
        </div>
        <nav aria-label="Expense pages" className="mt-5 flex gap-4">
          {page > 1 && (
            <Link href={`/store/expenses?${query}&page=${page - 1}`}>
              Previous
            </Link>
          )}
          {page * 100 < data.count && (
            <Link href={`/store/expenses?${query}&page=${page + 1}`}>Next</Link>
          )}
        </nav>
      </OperationalPanel>
    </ProtectedPageFrame>
  );
}
