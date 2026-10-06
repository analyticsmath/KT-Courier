import { Prisma } from "@prisma/client";

type Rule = Readonly<{ path: string; title?: string }>;
const rules: Readonly<Record<string, readonly Rule[]>> = {
  "/groceries/household": [{ path: "/household-essentials-80/cleaning-supplies-detergents-disinfectants-etc-144" }],
  "/groceries/beverages": [{ path: "/beverages-17/soft-drinks-52" }, { path: "/beverages-17/fresh-juices-smoothies-54" }],
  "/fashion/accessories": [{ path: "/fashion-apparel-288/accessories-312" }],
  "/food-dining/burgers": [{ path: "/burger-373" }, { path: "/chicken-burger-396" }, { path: "/restaurants-7/fast-food-10", title: "burger" }],
  "/food-dining/grill": [{ path: "/meat-376" }, { path: "/wings-374" }, { path: "/restaurants-7/casual-dining-11" }, { path: "/mini-platter-398" }],
  "/food-dining/traditional": [{ path: "/restaurants-7/fast-food-10", title: "kota" }],
  "/food-dining": [{ path: "/restaurants-7" }, { path: "/sandwich-400" }, { path: "/dagwood-375" }, { path: "/wraps-404" }],
  "/home-living/cookware-dining": [{ path: "/home-living-290/kitchenware-320" }, { path: "/drinkware-travel-mugs-423" }, { path: "/kitchen-appliances-kettles-426" }, { path: "/kitchen-storage-countertop-organization-428" }],
  "/home-living": [{ path: "/home-living-290/furniture-318" }, { path: "/laundry-care-430" }, { path: "/shipping-boxes-388" }, { path: "/shipping-boxes-389" }, { path: "/packaging-supplies-406" }, { path: "/sports-outdoors-292/outdoor-gear-328" }, { path: "/toys-kids-baby-291" }],
  "/pharmacy/personal-care": [{ path: "/clinica-384/skincare-385" }, { path: "/health-beauty-289" }, { path: "/skin-care-420" }, { path: "/makeup-418" }, { path: "/personal-care-422" }, { path: "/skincare-devices-facial-care-434" }],
  "/pharmacy/first-aid": [{ path: "/health-wellness-299/personal-care-352", title: "nebulizer" }],
  "/pharmacy/vitamins": [{ path: "/health-wellness-299/personal-care-352", title: "hibiscus|soursop" }, { path: "/health-wellness-299/medical-supplies-351", title: "soursop|sea moss" }],
  "/electronics": [{ path: "/electronics-287" }, { path: "/printer-ink-cartridges-407" }, { path: "/printer-ink-toner-408" }],
  "/automotive": [{ path: "/automotive-294" }],
};

/** Reviewed browse aliases for the imported taxonomy. Canonical source records stay unchanged.
 * Native categories always match; descendants roll up, and empty categories stay empty.
 * Title qualifiers prevent known misleading legacy category names from misclassifying products.
 */
function categoryRules(requested: string): Rule[] {
  const path = `/${requested.replace(/^\/+|\/+$/g, "")}`;
  return [{ path }, ...Object.entries(rules).flatMap(([target, aliases]) => target === path || target.startsWith(`${path}/`) ? aliases : [])];
}

export function matchesStorefrontCategory(document: Readonly<{ categoryPath: string; title: string }>, requested: string): boolean {
  const categoryPath = `/${document.categoryPath.replace(/^\/+|\/+$/g, "")}`;
  return categoryRules(requested).some(rule => (categoryPath === rule.path || categoryPath.startsWith(`${rule.path}/`)) && (!rule.title || new RegExp(rule.title, "i").test(document.title)));
}

/** The database candidate filter and final in-memory filter share the same reviewed rules. */
export function storefrontCategoryPredicate(requested: string): Prisma.Sql {
  return Prisma.sql`(${Prisma.join(categoryRules(requested).map(rule => {
    const prefix = `${rule.path}/`;
    const path = Prisma.sql`("categoryPath" = ${rule.path} OR LEFT("categoryPath", ${prefix.length}) = ${prefix})`;
    return rule.title ? Prisma.sql`(${path} AND "title" ~* ${rule.title})` : path;
  }), " OR ")})`;
}
