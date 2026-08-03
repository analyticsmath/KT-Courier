export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  badge?: string | number;
  external?: boolean;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}
