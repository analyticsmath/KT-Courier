export type DispatchCandidate = { id: string; driverCode: string; eligible: boolean; regionMatch: boolean; vehicleMatch: boolean; activeLoad: number; capacity: number; availabilityUpdatedAt: Date | null };
export function rankDispatchCandidates(candidates: DispatchCandidate[]) {
  return [...candidates].sort((a, b) => Number(b.eligible) - Number(a.eligible) || Number(b.regionMatch) - Number(a.regionMatch) || Number(b.vehicleMatch) - Number(a.vehicleMatch) || a.activeLoad / a.capacity - b.activeLoad / b.capacity || a.activeLoad - b.activeLoad || (a.availabilityUpdatedAt?.getTime() ?? 0) - (b.availabilityUpdatedAt?.getTime() ?? 0) || a.driverCode.localeCompare(b.driverCode) || a.id.localeCompare(b.id));
}
