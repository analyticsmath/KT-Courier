type NotificationDomain = Readonly<{
  sourceAuthority: string;
  eventType: string;
  templateKey: string;
  recipientPolicyKey: string;
}>;

type NotificationTemplateRoot = Readonly<{ id: string; key: string }>;
type NotificationTemplateVersion = Readonly<{
  id: string;
  templateId: string;
  versionNumber: number;
  status: string;
  approvedAt: Date | string | null;
}>;
type NotificationRecipientPolicyVersion = Readonly<{
  id: string;
  key: string;
  versionNumber: number;
  status: string;
  approvedAt: Date | string | null;
}>;
type NotificationRoute = Readonly<{
  id: string;
  sourceAuthority: string;
  sourceEventType: string;
}>;
type NotificationRouteVersion = Readonly<{
  routeId: string;
  status: string;
  approvedAt: Date | string | null;
  activatedAt: Date | string | null;
  templateKey: string;
  templateVersionId: string;
  recipientPolicyVersionId: string;
}>;

type NotificationGovernanceInput = Readonly<{
  required: readonly NotificationDomain[];
  templateRoots: readonly NotificationTemplateRoot[];
  templateVersions: readonly NotificationTemplateVersion[];
  recipientPolicyVersions: readonly NotificationRecipientPolicyVersion[];
  routes: readonly NotificationRoute[];
  routeVersions: readonly NotificationRouteVersion[];
}>;

function isApproved(status: string, approvedAt: Date | string | null): boolean {
  return status === "APPROVED" && approvedAt !== null;
}

function latestByVersion<T extends { versionNumber: number }>(versions: readonly T[]): T | null {
  let latest: T | null = null;
  for (const version of versions) {
    if (!latest || version.versionNumber > latest.versionNumber) latest = version;
  }
  return latest;
}

/** Evaluate each notification governance gate against its own current authority. */
export function evaluateRequiredNotificationGovernance(input: NotificationGovernanceInput) {
  const templateRootsByKey = new Map<string, NotificationTemplateRoot[]>();
  for (const template of input.templateRoots) {
    const roots = templateRootsByKey.get(template.key) ?? [];
    roots.push(template);
    templateRootsByKey.set(template.key, roots);
  }

  const policyVersionsByKey = new Map<string, NotificationRecipientPolicyVersion[]>();
  for (const policy of input.recipientPolicyVersions) {
    const versions = policyVersionsByKey.get(policy.key) ?? [];
    versions.push(policy);
    policyVersionsByKey.set(policy.key, versions);
  }

  const isCurrentTemplatePublished = (domain: NotificationDomain): boolean => {
    const roots = templateRootsByKey.get(domain.templateKey) ?? [];
    if (roots.length !== 1) return false;
    const versions = input.templateVersions.filter((version) => version.templateId === roots[0]!.id);
    const latest = latestByVersion(versions);
    return !!latest && latest.status === "PUBLISHED" && latest.approvedAt !== null;
  };

  const currentPolicy = (domain: NotificationDomain): NotificationRecipientPolicyVersion | null =>
    latestByVersion(policyVersionsByKey.get(domain.recipientPolicyKey) ?? []);

  const isCurrentRecipientPolicyApproved = (domain: NotificationDomain): boolean => {
    const latest = currentPolicy(domain);
    return !!latest && isApproved(latest.status, latest.approvedAt);
  };

  const isCurrentRouteActive = (domain: NotificationDomain): boolean => {
    const matchingRoutes = input.routes.filter(
      (route) => route.sourceAuthority === domain.sourceAuthority && route.sourceEventType === domain.eventType,
    );
    if (matchingRoutes.length !== 1) return false;
    const matchingVersions = input.routeVersions.filter(
      (version) => version.routeId === matchingRoutes[0]!.id && version.status === "ACTIVE",
    );
    if (matchingVersions.length !== 1) return false;
    const version = matchingVersions[0]!;
    if (!version.approvedAt || !version.activatedAt || version.templateKey !== domain.templateKey) return false;

    const roots = templateRootsByKey.get(domain.templateKey) ?? [];
    const latestTemplate = roots.length === 1
      ? latestByVersion(input.templateVersions.filter((candidate) => candidate.templateId === roots[0]!.id))
      : null;
    const policy = currentPolicy(domain);
    return !!latestTemplate && latestTemplate.status === "PUBLISHED" && latestTemplate.approvedAt !== null &&
      version.templateVersionId === latestTemplate.id &&
      !!policy && isApproved(policy.status, policy.approvedAt) && version.recipientPolicyVersionId === policy.id;
  };

  const missingTemplates = input.required
    .filter((domain) => !isCurrentTemplatePublished(domain))
    .map((domain) => `${domain.sourceAuthority}:${domain.eventType}`);
  const missingRecipientPolicies = input.required
    .filter((domain) => !isCurrentRecipientPolicyApproved(domain))
    .map((domain) => `${domain.sourceAuthority}:${domain.eventType}`);
  const missingRoutes = input.required
    .filter((domain) => !isCurrentRouteActive(domain))
    .map((domain) => `${domain.sourceAuthority}:${domain.eventType}`);
  const missingDomains = input.required
    .filter((domain) =>
      !isCurrentTemplatePublished(domain) ||
      !isCurrentRecipientPolicyApproved(domain) ||
      !isCurrentRouteActive(domain),
    )
    .map((domain) => `${domain.sourceAuthority}:${domain.eventType}`);

  return { missingTemplates, missingRecipientPolicies, missingRoutes, missingDomains } as const;
}
