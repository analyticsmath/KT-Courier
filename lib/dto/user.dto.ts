import type {
  User,
  CustomerProfile,
  StoreProfile,
  Store,
} from "@/types/db";
import type { UserRole, UserStatus, StoreStatus } from "@/types/db";

// ─── Safe public user fields (never passwordHash, tokenHash, OTP data) ────────

export interface UserPublicDto {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export function toUserPublicDto(user: User): UserPublicDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

// ─── Customer profile ─────────────────────────────────────────────────────────

export interface CustomerProfileDto {
  user: UserPublicDto;
  profile: {
    id: string;
    displayName: string | null;
    defaultPhone: string | null;
  } | null;
}

export function toCustomerProfileDto(
  user: User,
  profile: CustomerProfile | null
): CustomerProfileDto {
  return {
    user: toUserPublicDto(user),
    profile: profile
      ? {
          id: profile.id,
          displayName: profile.displayName,
          defaultPhone: profile.defaultPhone,
        }
      : null,
  };
}

// ─── Store profile ────────────────────────────────────────────────────────────

export interface StoreAddressDto {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;
}

export interface StoreProfileDto {
  user: UserPublicDto;
  storeProfile: {
    id: string;
    storeName: string;
    contactPerson: string | null;
    businessPhone: string | null;
    businessEmail: string | null;
    status: StoreStatus;
  } | null;
  store: {
    id: string;
    name: string;
    slug: string;
    status: StoreStatus;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    featured: boolean;
    address: StoreAddressDto;
    createdAt: Date;
  } | null;
}

export function toStoreProfileDto(
  user: User,
  storeProfile: StoreProfile | null,
  store: Store | null
): StoreProfileDto {
  return {
    user: toUserPublicDto(user),
    storeProfile: storeProfile
      ? {
          id: storeProfile.id,
          storeName: storeProfile.storeName,
          contactPerson: storeProfile.contactPerson,
          businessPhone: storeProfile.businessPhone,
          businessEmail: storeProfile.businessEmail,
          status: storeProfile.status,
        }
      : null,
    store: store
      ? {
          id: store.id,
          name: store.name,
          slug: store.slug,
          status: store.status,
          contactName: store.contactName,
          contactEmail: store.contactEmail,
          contactPhone: store.contactPhone,
          featured: store.featured,
          address: {
            addressLine1: store.addressLine1,
            addressLine2: store.addressLine2,
            city: store.city,
            province: store.province,
            postalCode: store.postalCode,
            country: store.country,
          },
          createdAt: store.createdAt,
        }
      : null,
  };
}

// ─── Admin user list ──────────────────────────────────────────────────────────

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export function toAdminUserListItem(user: User): AdminUserListItem {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

// ─── Admin store list ─────────────────────────────────────────────────────────

export interface AdminStoreListItem {
  id: string;
  name: string;
  slug: string;
  status: StoreStatus;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
  ownerUser: { id: string; email: string; name: string | null } | null;
}

export function toAdminStoreListItem(
  store: Store & { ownerUser: User | null }
): AdminStoreListItem {
  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    status: store.status,
    contactName: store.contactName,
    contactEmail: store.contactEmail,
    contactPhone: store.contactPhone,
    featured: store.featured,
    createdAt: store.createdAt,
    updatedAt: store.updatedAt,
    ownerUser: store.ownerUser
      ? {
          id: store.ownerUser.id,
          email: store.ownerUser.email,
          name: store.ownerUser.name,
        }
      : null,
  };
}
