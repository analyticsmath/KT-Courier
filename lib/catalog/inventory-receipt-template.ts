type Location = { publicReference: string; status: string; isPrimary?: boolean };
type InventoryItem = {
  publicReference: string;
  trackingMode: string;
  version: number;
  levels: { location: Location }[];
};

export function inventoryReceiptTemplate(inventory: InventoryItem[], locations: Location[]) {
  const active = locations.filter(location => location.status === "ACTIVE");
  const fallback = active.find(location => location.isPrimary) ?? active[0];
  return inventory.flatMap(item => {
    if (item.trackingMode !== "TRACKED") return [];
    const location = item.levels.find(level => active.some(candidate => candidate.publicReference === level.location.publicReference))?.location ?? fallback;
    return location ? [{ inventoryReference: item.publicReference, locationReference: location.publicReference, version: item.version }] : [];
  });
}
