import { cn } from "@/lib/utils/cn";
import type { TableColumn } from "@/types/ui";
import { EmptyState } from "./EmptyState";

interface DataTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyField: keyof T;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  emptyTitle = "No records found",
  emptyDescription,
  className,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className={cn("w-full overflow-x-auto rounded-xl border border-[--kt-border]", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[--kt-border] bg-[--kt-surface-muted]">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={cn(
                  "px-4 py-3 text-left text-xs font-semibold text-[--kt-text-muted] uppercase tracking-wide whitespace-nowrap",
                  col.className
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[--kt-border]">
          {data.map((row) => (
            <tr
              key={String(row[keyField])}
              className="bg-[--kt-surface] hover:bg-[--kt-surface-muted] transition-colors"
            >
              {columns.map((col) => (
                <td
                  key={String(col.key)}
                  className={cn("px-4 py-3 text-[--kt-text-soft]", col.className)}
                >
                  {col.render
                    ? col.render(row)
                    : String(row[col.key as keyof T] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
