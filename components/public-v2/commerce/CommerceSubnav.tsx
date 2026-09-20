"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./commerce.module.css";

const links = [
  { label: "Shop", href: "/shop", exact: true },
  { label: "Categories", href: "/shop/categories" },
  { label: "Stores", href: "/shop/stores" },
  { label: "Collections", href: "/shop/collections" },
  { label: "Search", href: "/shop/search" },
];

export function CommerceSubnav() {
  const pathname = usePathname();
  if (pathname.startsWith("/shop/products/")) return null;

  return (
    <nav aria-label="Shop navigation" className={styles.commerceSubnav}>
      <div className={styles.commerceSubnavInner}>
        {links.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link aria-current={active ? "page" : undefined} href={item.href} key={item.href}>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
