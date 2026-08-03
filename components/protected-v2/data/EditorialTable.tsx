import { cn } from "@/lib/utils/cn";

export type EditorialTableColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  align?: "start" | "end";
  /** Supply only when this rendered column is backed by real sorting. */
  sortDirection?: "ascending" | "descending";
  priority?: "primary" | "secondary" | "optional";
};

export function EditorialTable<T extends { id: string }>({
  caption,
  columns,
  rows,
  mobileMode = "scroll",
  emptyState,
  className,
}: {
  caption: string;
  columns: readonly EditorialTableColumn<T>[];
  rows: readonly T[];
  mobileMode?: "scroll" | "priority" | "stack";
  emptyState?: React.ReactNode;
  className?: string;
}) {
  if (!rows.length) return <>{emptyState ?? <p className="eo-table-empty" role="status">No records are available.</p>}</>;
  return (
    <div className={cn("eo-table-wrap", `eo-table-wrap--${mobileMode}`, className)}>
      <table className="eo-table">
        <caption>{caption}</caption>
        <thead><tr>{columns.map((column) => <th aria-sort={column.sortDirection ? column.sortDirection : undefined} className={cn(column.align === "end" && "is-numeric", column.priority && `eo-table__cell--${column.priority}`)} key={column.id} scope="col">{column.header}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}>{columns.map((column) => <td className={cn(column.align === "end" && "is-numeric", column.priority && `eo-table__cell--${column.priority}`)} data-label={column.header} key={column.id}>{column.cell(row)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
