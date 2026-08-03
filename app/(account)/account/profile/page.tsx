import type { Metadata } from "next";
import { OperationalPanel } from "@/components/protected-v2";
import { CustomerAction, CustomerPage } from "@/components/protected-v2/customer/CustomerPresentation";
import { ProfileForm } from "@/components/forms/ProfileForm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCustomerProfile } from "@/lib/services/profiles.service";

export const metadata: Metadata = { title: "Profile" };

export default async function AccountProfilePage() {
  const session = await getCurrentUser();
  const profile = await getCustomerProfile(session!.id);
  const defaultValues = { name: profile?.user.name ?? "", email: profile?.user.email ?? "", phone: profile?.user.phone ?? "" };

  return (
    <CustomerPage eyebrow="Account" title="Profile" description="Manage the personal details associated with this account.">
      <OperationalPanel title="Personal details"><ProfileForm defaultValues={defaultValues} /></OperationalPanel>
      <OperationalPanel title="Password" description="Password changes continue through the existing secure reset flow."><CustomerAction href="/forgot-password">Reset password</CustomerAction></OperationalPanel>
    </CustomerPage>
  );
}
