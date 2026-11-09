/** Normalise equivalent domestic address country spellings before pickup checks.
 * Historical addresses can contain ISO ZA/ZAF or local RSA, while new
 * addresses use the display name. This only recognises country identity;
 * it never establishes map, service-area, or payment eligibility.
 */
export function isSouthAfricanCountry(value: string | null | undefined): boolean {
  const normalised = value?.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-ZA") ?? "";
  return ["south africa", "za", "zaf", "rsa"].includes(normalised);
}
