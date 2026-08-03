import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AddressBookManager } from "@/components/account/AddressBookManager";
import { OperationalPanel } from "@/components/protected-v2";
import { CustomerPage } from "@/components/protected-v2/customer/CustomerPresentation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listCustomerAddresses } from "@/lib/services/customer-addresses.service";

export const metadata: Metadata = { title: "Saved Addresses" };

export default async function AccountAddressesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const addresses = await listCustomerAddresses(user.id);

  return <CustomerPage eyebrow="Address book" title="Saved addresses" description="Manage the pickup and drop-off addresses you use regularly."><OperationalPanel title="Your saved addresses" description="The default marker applies only within its address type."><AddressBookManager initialAddresses={addresses} /></OperationalPanel></CustomerPage>;
}
