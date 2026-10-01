import { requireBusinessPage } from "@/lib/client-platform/business-auth";
import { listConversations } from "@/lib/client-platform/conversations.service";
import { Conversations } from "@/components/forms/Conversations";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
export const metadata = { title: "Messages" };
export default async function Page() {
  const { user } = await requireBusinessPage("/store/chat");
  const rows = await listConversations(user, "STORE");
  const initialConversations = rows.map((r) => ({
    ...r,
    closedAt: r.closedAt?.toISOString() ?? null,
  }));
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Conversations"
        title="Messages"
        description="Delivery conversations and KT support have separate histories. Use your own account to read and reply."
      />
      <OperationalPanel title="Your conversations">
        <Conversations
          scope="STORE"
          initialConversations={initialConversations}
        />
      </OperationalPanel>
    </ProtectedPageFrame>
  );
}
