export function storeOfferReviewLabel(
  status: string,
  approvedByUserId: string | null,
): string {
  if (approvedByUserId) return "Approved";
  if (status === "SUBMITTED") return "Awaiting KT review";
  if (status === "NEEDS_CHANGES") return "Changes requested";
  if (status === "DRAFT") return "Not submitted";
  if (["ACTIVE", "PAUSED", "OUT_OF_STOCK"].includes(status)) {
    return "Review evidence unavailable";
  }
  return "Not reviewed";
}

export function storeOfferReviewDescription(
  status: string,
  publicationStatus: string,
  approvedByUserId: string | null,
): string {
  if (approvedByUserId && publicationStatus !== "PUBLISHED") {
    return "KT Couriers approved this offer. A KT Couriers administrator must still publish it after the seller readiness checks pass.";
  }
  if (status === "SUBMITTED") {
    return "Submitted for independent KT Couriers review. The offer is not public while publication is pending.";
  }
  if (status === "NEEDS_CHANGES") {
    return "KT Couriers requested corrections before this offer can be reviewed again.";
  }
  if (publicationStatus === "PUBLISHED") {
    return "This offer has a published listing record. Current checkout availability is shown separately.";
  }
  return "Submit the offer for independent KT Couriers review before it can be published.";
}
