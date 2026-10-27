/** The recipient's identity belongs to restricted proof-of-delivery evidence,
 * not the default public order history or tracking timeline. */
export function publicDeliveryCompletionNote(publicNote: string | null | undefined): string {
  return publicNote?.trim() || "Your parcel has been delivered.";
}
