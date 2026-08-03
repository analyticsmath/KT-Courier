import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listDrivers, createDriverProfile } from "@/lib/services/admin-drivers.service";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import {
  created,
  unprocessable,
  badRequest,
  paginated,
  parsePagination,
} from "@/lib/api/response";
import { AdminCreateDriverSchema } from "@/lib/validation/driver";
import { formatZodErrors } from "@/lib/validation/auth";
import { DriverStatus, DriverAvailability } from "@/types/db";

// GET: list drivers
export async function GET(req: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.DRIVERS_READ, {
    request: req,
  });
  if (auth.response) return auth.response;

  const sp = req.nextUrl.searchParams;
  const { page, pageSize } = parsePagination(sp);

  const status = sp.get("status") as DriverStatus | null;
  const availability = sp.get("availability") as DriverAvailability | null;
  const regionId = sp.get("regionId") || undefined;
  const search = sp.get("search")?.trim() || undefined;

  try {
    const { data, total } = await listDrivers({
      status: status ?? undefined,
      availability: availability ?? undefined,
      regionId,
      search,
      page,
      pageSize,
    });

    return paginated(data, total, page, pageSize);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list drivers.";
    return badRequest(message);
  }
}

// POST: create/link driver profile
export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const auth = await requireAdminApiPermission(PERMISSIONS.DRIVERS_CREATE, {
    request: req,
  });
  if (auth.response) return auth.response;
  const session = auth.user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = AdminCreateDriverSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  try {
    const driver = await createDriverProfile(session.id, parsed.data);
    return created(driver);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create driver profile.";
    return badRequest(message);
  }
}
