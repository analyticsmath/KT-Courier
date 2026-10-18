/** Keep every catalog descendant on its existing visual contract. */
export function isProtectedCatalog(pathname: string) {
  return pathname === "/shop" || pathname.startsWith("/shop/");
}
