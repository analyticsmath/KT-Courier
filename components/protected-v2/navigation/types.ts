export type ProtectedApplicationContext =
  | "CUSTOMER"
  | "STORE"
  | "DRIVER"
  | "PROMOTER"
  | "DEVELOPER"
  | "ADMIN"
  | "SUPER_ADMIN";

export type ProtectedIconName =
  | "activity"
  | "archive"
  | "bell"
  | "book"
  | "briefcase"
  | "building"
  | "card"
  | "chart"
  | "clipboard"
  | "cog"
  | "credit-card"
  | "file"
  | "folder"
  | "globe"
  | "home"
  | "key"
  | "map"
  | "package"
  | "people"
  | "plus"
  | "route"
  | "shield"
  | "store"
  | "support"
  | "wallet";

export type ProtectedNavigationItem = {
  id: string;
  label: string;
  href: string;
  icon: ProtectedIconName;
  group: string;
  requiredPermissions?: readonly string[];
  exact?: boolean;
  mobilePriority?: number;
  contexts: readonly ProtectedApplicationContext[];
};

export type ProtectedNavigationGroup = {
  id: string;
  label: string;
  items: readonly ProtectedNavigationItem[];
};

export type ProtectedNavigationProjection = {
  groups: readonly ProtectedNavigationGroup[];
  mobileNavigation: readonly ProtectedNavigationItem[];
};
