import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export type PublicBreadcrumbItem = { label: string; href?: string };

export function PublicBreadcrumbs({ items, className }: { items: readonly PublicBreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn(className)}>
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}:${index}`}>
            {item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
