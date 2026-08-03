import type { ProtectedStatusTone } from "@/components/protected-v2/feedback/ProtectedStatus";

/** Explicit, display-only state mapping. Unknown source values remain neutral. */
export function storeAccountState(status: string | null | undefined): Readonly<{ label: string; tone: ProtectedStatusTone; description: string }> {
  switch (status) {
    case "ACTIVE": return { label: "Active", tone: "success", description: "Store operations are available to this account." };
    case "PENDING": return { label: "Awaiting approval", tone: "warning", description: "Complete saved store details while approval remains pending." };
    case "SUSPENDED": return { label: "Suspended", tone: "danger", description: "Store operations are restricted. Contact support for the next step." };
    case "ARCHIVED": return { label: "Archived", tone: "neutral", description: "This store record is no longer operational." };
    default: return { label: "Status unavailable", tone: "neutral", description: "The current store state is unavailable." };
  }
}
