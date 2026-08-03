import { ProtectedVisualRoot } from "@/components/protected-v2/foundation/ProtectedVisualRoot";
import { ProtectedDesktopNavigation } from "@/components/protected-v2/navigation/ProtectedNavigation";
import { ProtectedMobileNavigation } from "@/components/protected-v2/navigation/ProtectedMobileNavigation";
import type {
  ProtectedApplicationContext,
  ProtectedNavigationGroup,
  ProtectedNavigationItem,
} from "@/components/protected-v2/navigation/types";

export type EditorialOperationsShellProps = {
  user: {
    displayName: string;
    roleLabel: string;
    avatarUrl?: string | null;
  };
  navigation: readonly ProtectedNavigationGroup[];
  mobileNavigation: readonly ProtectedNavigationItem[];
  currentPath?: string;
  notifications?: {
    unreadCount: number;
    href: string;
  };
  context: ProtectedApplicationContext;
  contextLabel: string;
  primaryAction?: { label: string; href: string };
  navigationFooter?: React.ReactNode;
  children: React.ReactNode;
};

function profileHrefFor(navigation: readonly ProtectedNavigationGroup[]): string | undefined {
  return navigation.flatMap((group) => group.items).find((item) => /profile|settings/i.test(item.id))?.href;
}

/**
 * Predominantly server-rendered protected application shell. Interactive
 * navigation and account controls are isolated to sibling client islands.
 */
export function EditorialOperationsShell({
  user,
  navigation,
  mobileNavigation,
  currentPath: _currentPath,
  notifications,
  context,
  contextLabel,
  primaryAction,
  navigationFooter,
  children,
}: EditorialOperationsShellProps) {
  void _currentPath;
  const profileHref = profileHrefFor(navigation);

  return (
    <ProtectedVisualRoot className="eo-shell">
      <a className="eo-skip-link" href="#protected-main-content">Skip to main content</a>
      <ProtectedDesktopNavigation contextLabel={contextLabel} footer={navigationFooter} groups={navigation} user={user} />
      <div className="eo-shell__content">
        <ProtectedMobileNavigation
          context={context}
          contextLabel={contextLabel}
          groups={navigation}
          mobileNavigation={mobileNavigation}
          notifications={notifications}
          primaryAction={primaryAction}
          profileHref={profileHref}
          user={user}
        />
        <main className="eo-shell__main" id="protected-main-content" tabIndex={-1}>{children}</main>
      </div>
    </ProtectedVisualRoot>
  );
}
