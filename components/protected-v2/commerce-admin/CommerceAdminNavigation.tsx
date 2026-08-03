import { CommerceWorkspaceNav } from "./CommerceAdminPrimitives";

const CATALOG_ITEMS = [
  { label: "Overview", href: "/admin/catalog" },
  { label: "Categories", href: "/admin/catalog/categories" },
  { label: "Product types", href: "/admin/catalog/product-types" },
  { label: "Products", href: "/admin/catalog/products" },
  { label: "Offers", href: "/admin/catalog/offers" },
  { label: "Media", href: "/admin/catalog/media" },
  { label: "Moderation", href: "/admin/catalog/moderation" },
  { label: "Duplicates", href: "/admin/catalog/duplicates" },
] as const;

const STOREFRONT_ITEMS = [
  { label: "Collections", href: "/admin/storefront/collections" },
  { label: "Projections", href: "/admin/storefront/projections" },
  { label: "Search synonyms", href: "/admin/storefront/search-synonyms" },
] as const;

export function CatalogAdministrationNav({ currentPath }: { currentPath: string }) {
  return <CommerceWorkspaceNav currentPath={currentPath} items={CATALOG_ITEMS} label="Catalog administration" />;
}

export function StorefrontAdministrationNav({ currentPath }: { currentPath: string }) {
  return <CommerceWorkspaceNav currentPath={currentPath} items={STOREFRONT_ITEMS} label="Storefront administration" />;
}
