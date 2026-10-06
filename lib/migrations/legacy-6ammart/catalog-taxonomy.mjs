/** Shared by the database importer and the standalone plan generator. */
export function legacyProductTypeCode(moduleId, names = []) {
  if (Number(moduleId) === 2) return "GROCERIES";
  if (Number(moduleId) === 3) return "HEALTH_WELLNESS";
  if (Number(moduleId) === 6) return "FOOD_DINING";
  const text = names.join(" ").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/automotive|vehicle|car\b|motor|cv joint/.test(text)) return "AUTOMOTIVE";
  if (/fashion|apparel|clothing|shoe|footwear|accessor|jewellery|jewelry/.test(text)) return "FASHION_APPAREL";
  if (/electronic|printer|ink|cartridge|computer|phone|tech|gadget/.test(text)) return "ELECTRONICS";
  if (/health|beauty|skin|makeup|cosmetic|wellness|clinical|body butter|body wash/.test(text)) return "HEALTH_WELLNESS";
  if (/book|stationery|school|office supply/.test(text)) return "BOOKS_STATIONERY";
  if (/cake|bakery|bread|pastr/.test(text)) return "CAKES_BAKERY";
  if (/flower|plant|floral/.test(text)) return "FLOWERS_PLANTS";
  if (/pet|animal/.test(text)) return "PET_CARE";
  return "HOME_LIVING";
}

export function legacyItemTaxonomyNames(item, categories) {
  const ids = [item.category_id, ...(Array.isArray(item.category_ids) ? item.category_ids.map((link) => typeof link === "object" && link ? (link.id ?? link.category_id) : link) : [])];
  return [String(item.name ?? ""), ...ids.map((id) => categories.get(Number(id))?.name).filter((name) => typeof name === "string")];
}
