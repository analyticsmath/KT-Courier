import { ProcessorOperationsManager } from "@/components/admin/ProcessorOperationsManager";
import { ProtectedPageFrame, ProtectedPageHeader } from "@/components/protected-v2";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getProcessorInventory } from "@/lib/processors/processor-service";

export default async function ProcessorsPage() {
  await requireAdminPagePermission(PERMISSIONS.PROCESSORS_READ);
  const inventory = await getProcessorInventory().catch(() => []);

  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Operations"
        title="Processor operations"
        description="Review processor health, lease ownership and run history. Configure controlled dry-runs and authorized executions."
      />

      <ProcessorOperationsManager processors={inventory} />
    </ProtectedPageFrame>
  );
}
