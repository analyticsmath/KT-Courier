import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { storefrontJson, storefrontNotFound } from "@/lib/storefront/storefront-api-policy";

/** Private, noindex source preview. It never creates projection or public search evidence. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ snapshotReference: string }> }) {
  const user = await getCurrentUser();
  if (!user) return storefrontJson({ error: "Authentication required." }, 401, { private: true });
  const snapshot = await prisma.catalogPublicationSnapshot.findUnique({ where: { publicReference: (await params).snapshotReference }, include: { offer: { include: { store: { select: { ownerUserId: true } } } } } });
  if (!snapshot) return storefrontNotFound();
  const permitted = snapshot.offer.store.ownerUserId === user.id || await hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.STOREFRONT_PREVIEW_READ });
  if (!permitted) return storefrontNotFound();
  return storefrontJson({ preview: true, robots: "noindex", status: snapshot.status, publicationVersion: snapshot.publicationVersion, snapshot: snapshot.snapshot }, 200, { private: true });
}

