import { prisma } from "@/lib/db/prisma";
import { revokeAllUserSessions } from "@/lib/auth/session";
import {
  recordSecurityEvent,
  SECURITY_EVENT_TYPES,
} from "@/lib/services/security-events.service";
import {
  toAdminUserListItem,
  toUserPublicDto,
  toCustomerProfileDto,
  toStoreProfileDto,
  type AdminUserListItem,
  type UserPublicDto,
  type CustomerProfileDto,
  type StoreProfileDto,
} from "@/lib/dto/user.dto";
import type { UserRole, UserStatus } from "@/types/db";
import { UserStatus as UserStatusValue } from "@/types/db";

// ─── List ─────────────────────────────────────────────────────────────────────

export interface AdminUserListOptions {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  page: number;
  pageSize: number;
}

export interface AdminUserListResult {
  data: AdminUserListItem[];
  total: number;
}

export async function listUsers(
  opts: AdminUserListOptions
): Promise<AdminUserListResult> {
  const { role, status, search, page, pageSize } = opts;
  const skip = (page - 1) * pageSize;

  const where = {
    ...(role && { role }),
    ...(status && { status }),
    ...(search && {
      OR: [
        { email: { contains: search, mode: "insensitive" as const } },
        { name: { contains: search, mode: "insensitive" as const } },
        { phone: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take: pageSize, orderBy: { createdAt: "desc" } }),
    prisma.user.count({ where }),
  ]);

  return { data: users.map(toAdminUserListItem), total };
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export interface AdminUserDetail {
  user: UserPublicDto;
  profile:
    | { type: "customer"; data: CustomerProfileDto }
    | { type: "store"; data: StoreProfileDto }
    | null;
  orderCount: number;
}

export async function getUserDetail(id: string): Promise<AdminUserDetail | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      customerProfile: true,
      storeProfile: true,
      ownedStores: { take: 1, orderBy: { createdAt: "asc" } },
    },
  });
  if (!user) return null;

  const orderCount = await prisma.order.count({ where: { customerId: id } });

  let profile: AdminUserDetail["profile"] = null;
  if (user.role === "CUSTOMER" && user.customerProfile) {
    profile = {
      type: "customer",
      data: toCustomerProfileDto(user, user.customerProfile),
    };
  } else if (user.role === "STORE") {
    profile = {
      type: "store",
      data: toStoreProfileDto(user, user.storeProfile, user.ownedStores[0] ?? null),
    };
  }

  return { user: toUserPublicDto(user), profile, orderCount };
}

// ─── Update ───────────────────────────────────────────────────────────────────

export interface AdminUpdateUserInput {
  name?: string;
  phone?: string;
  status?: UserStatus;
}

export interface AdminUpdateUserOptions {
  actorUserId?: string | null;
  request?: Request;
}

export async function adminUpdateUser(
  id: string,
  input: AdminUpdateUserInput,
  options: AdminUpdateUserOptions = {}
): Promise<UserPublicDto> {
  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, status: true },
  });

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name || null }),
      ...(input.phone !== undefined && { phone: input.phone || null }),
      ...(input.status !== undefined && { status: input.status }),
    },
  });

  if (existing && input.status !== undefined && input.status !== existing.status) {
    await recordSecurityEvent({
      type: SECURITY_EVENT_TYPES.USER_STATUS_CHANGED,
      severity: input.status === UserStatusValue.ACTIVE ? "INFO" : "HIGH",
      userId: id,
      actorUserId: options.actorUserId ?? null,
      message: "Admin changed user status",
      request: options.request,
      metadata: {
        from: existing.status,
        to: input.status,
      },
    });

    if (input.status !== UserStatusValue.ACTIVE) {
      const revokedSessionCount = await revokeAllUserSessions({
        userId: id,
        reason: "USER_STATUS_CHANGED",
        revokedByUserId: options.actorUserId ?? null,
      });

      await recordSecurityEvent({
        type: SECURITY_EVENT_TYPES.SESSION_REVOKED,
        severity: "HIGH",
        userId: id,
        actorUserId: options.actorUserId ?? null,
        message: "Revoked user sessions after status change",
        request: options.request,
        metadata: {
          reason: "USER_STATUS_CHANGED",
          status: input.status,
          revokedSessionCount,
        },
      });
    }
  }

  return toUserPublicDto(user);
}
