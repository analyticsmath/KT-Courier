import { cn } from "@/lib/utils/cn";

export type DateStripItem = { id: string; label: string; date: string; selected?: boolean; href?: string };

export function DateStrip({ items, ariaLabel = "Dates", className }: { items: readonly DateStripItem[]; ariaLabel?: string; className?: string }) {
  return <nav aria-label={ariaLabel} className={cn("eo-date-strip", className)}><ol>{items.map((item) => <li key={item.id}>{item.href ? <a aria-current={item.selected ? "date" : undefined} className={item.selected ? "is-selected" : undefined} href={item.href}><span>{item.label}</span><strong>{item.date}</strong></a> : <span aria-current={item.selected ? "date" : undefined} className={item.selected ? "is-selected" : undefined}><span>{item.label}</span><strong>{item.date}</strong></span>}</li>)}</ol></nav>;
}
