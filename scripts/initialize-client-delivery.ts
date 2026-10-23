import { prisma } from "../lib/db/prisma";
import { INITIAL_DELIVERY } from "../lib/client-platform/initial-delivery";
import { saveDeliveryConfiguration } from "../lib/client-platform/delivery.service";
import { installSelfNotificationPermissionDefaults, installStoreCatalogPermissionDefaults } from "../lib/auth/permission-bootstrap";

async function main() {
  const actor = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN", status: "ACTIVE" },
    select: { id: true },
  });
  if (!actor) throw new Error("Active superuser required for audited initialization");
  // Production cannot run the development seed; install missing catalog grants only.
  const catalog = await installStoreCatalogPermissionDefaults(prisma);
  console.log(JSON.stringify({ event: "catalog.owner_permissions_initialized", ...catalog }));
  const notifications = await installSelfNotificationPermissionDefaults(prisma);
  console.log(JSON.stringify({ event: "notifications.own_permissions_initialized", ...notifications }));
  for (const input of INITIAL_DELIVERY) {
    if (await prisma.deliveryServiceDefinition.findFirst({
      where: { stableKey: input.stableKey },
      select: { id: true },
    })) continue;
    await saveDeliveryConfiguration(actor.id, input);
    console.log(`Initialized ${input.stableKey}`);
  }
}
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Initialization failed");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
