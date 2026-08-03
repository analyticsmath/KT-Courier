import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listContactMessages } from "@/lib/services/admin-contact.service";
import { ContactMessageStatus } from "@/types/db";
import {
  serverError,
  paginated,
  parsePagination,
} from "@/lib/api/response";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.CONTACTS_READ, {
    request: req,
  });
  if (auth.response) return auth.response;

  const sp = req.nextUrl.searchParams;
  const { page, pageSize } = parsePagination(sp);

  const statusParam = sp.get("status") as ContactMessageStatus | null;
  const enquiryType = sp.get("enquiryType") ?? undefined;
  const search = sp.get("search") ?? undefined;

  try {
    const { data, total } = await listContactMessages({
      status: statusParam ?? undefined,
      enquiryType,
      search,
      page,
      pageSize: Math.min(pageSize, 100),
    });
    return paginated(data, total, page, pageSize);
  } catch {
    return serverError();
  }
}
