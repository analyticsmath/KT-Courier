import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listEmailLogs } from "@/lib/services/admin-email.service";
import { EmailStatus, EmailTemplateType } from "@/types/db";
import {
  serverError,
  paginated,
  parsePagination,
} from "@/lib/api/response";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.EMAILS_READ, {
    request: req,
  });
  if (auth.response) return auth.response;

  const sp = req.nextUrl.searchParams;
  const { page, pageSize } = parsePagination(sp);

  const statusParam = sp.get("status") as EmailStatus | null;
  const templateParam = sp.get("templateType") as EmailTemplateType | null;
  const search = sp.get("search") ?? undefined;

  try {
    const { data, total } = await listEmailLogs({
      status: statusParam ?? undefined,
      templateType: templateParam ?? undefined,
      search,
      page,
      pageSize: Math.min(pageSize, 100),
    });
    return paginated(data, total, page, pageSize);
  } catch {
    return serverError();
  }
}
