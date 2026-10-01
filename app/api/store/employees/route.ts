import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { ownedBusiness } from "@/lib/client-platform/store-access";
import {
  EmployeeInviteSchema,
  EmployeeUpdateSchema,
  inviteEmployee,
  updateEmployee,
} from "@/lib/client-platform/employees.service";
import { json, failure, mutation } from "@/lib/client-platform/api";
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Sign in to continue." }, 401);
  try {
    const store = await ownedBusiness(user.id);
    return json({
      employees: await prisma.storeEmployeeMembership.findMany({
        where: { storeId: store.id, status: { not: "REMOVED" } },
        select: {
          id: true,
          email: true,
          roleLabel: true,
          permissions: true,
          status: true,
          acceptedAt: true,
          inviteExpiresAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Sign in to continue." }, 401);
  const b = await mutation(req, `employees:${user.id}`);
  if ("response" in b) return b.response;
  const p = EmployeeInviteSchema.safeParse(b.body);
  if (!p.success)
    return json(
      { error: "Choose a valid email, role and module access." },
      422,
    );
  try {
    return json(await inviteEmployee(user.id, p.data), 201);
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Sign in to continue." }, 401);
  const b = await mutation(req, `employees:${user.id}`);
  if ("response" in b) return b.response;
  const p = EmployeeUpdateSchema.safeParse(b.body);
  if (!p.success)
    return json({ error: "Employee access details are invalid." }, 422);
  try {
    return json(await updateEmployee(user.id, p.data));
  } catch (e) {
    return failure(e);
  }
}
