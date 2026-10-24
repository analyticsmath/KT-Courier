export type PackageMeasurements = { lengthCm: number; widthCm: number; heightCm: number; weightKg: number };
export function packageFitsLimits(parcel: PackageMeasurements, profiles: { lengthCm: number; widthCm: number; heightCm: number; maximumWeightKg: number }[]): boolean {
  const dimensions = [parcel.lengthCm, parcel.widthCm, parcel.heightCm].sort((a,b) => a-b);
  return profiles.some(profile => {
    const limits = [profile.lengthCm, profile.widthCm, profile.heightCm].sort((a,b) => a-b);
    return parcel.weightKg <= profile.maximumWeightKg && dimensions.every((value, index) => value <= limits[index]);
  });
}
