import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";

const titles: Record<string, string> = {
  applications: "Developer applications",
  scopes: "Developer scope review",
  credentials: "Credential oversight",
  usage: "Quota and rate-policy records",
  requests: "Developer request audit",
  webhooks: "Webhook oversight",
  "webhook-deliveries": "Webhook deliveries",
  reconciliation: "Developer reconciliation",
};

export function DeveloperAdministrationUnavailable({ segments }: { segments: readonly string[] }) {
  const section = segments[0] ?? "overview";
  const title = titles[section] ?? "Developer administration";
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Developer administration" title={title} description="A protected route for existing developer administration authority." />
    <ProtectedState kind="unavailable" title="Protected developer projection unavailable" description="This route intentionally does not render credentials, hashes, signing material, authorization headers, private payloads, internal network evidence, provider secrets, or a live API console. The existing server API remains the authoritative boundary until a safe server projection is available." />
  </ProtectedPageFrame>;
}
