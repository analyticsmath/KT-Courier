import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getOwnedStoreRestriction } from "@/lib/services/store-restriction-notice.service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Business account status | KT Couriers" };

export default async function StoreStatusPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "STORE") redirect("/");
  const restriction = await getOwnedStoreRestriction(user.id);
  if (!restriction) redirect("/store");
  return (
    <main className="mx-auto min-h-[60vh] max-w-3xl px-5 py-16 sm:py-24">
      <Link className="text-sm underline underline-offset-4" href="/">KT Couriers home</Link>
      <h1 className="mt-8 text-3xl font-semibold tracking-tight sm:text-4xl">Business account restricted</h1>
      <p className="mt-3 text-lg">{restriction.name} is currently {restriction.status === "DISABLED" ? "disabled" : "suspended"}. Its business workspace and marketplace publishing privileges are unavailable while the restriction applies.</p>
      <section className="mt-8 border-t pt-6" aria-labelledby="restriction-reason">
        <h2 id="restriction-reason" className="text-xl font-semibold">Reason supplied by KT Couriers</h2>
        <p className="mt-3 whitespace-pre-wrap break-words">{restriction.reason ?? "An administrator reason is not available here. Contact KT Couriers support for details about the restriction."}</p>
        {restriction.recordedAt && <p className="mt-3 text-sm text-muted-foreground">Recorded {new Date(restriction.recordedAt).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}</p>}
      </section>
      <p className="mt-8 text-sm">For clarification or reinstatement, contact <a href="mailto:support@ktcouriers.com" className="underline underline-offset-4">support@ktcouriers.com</a>. Your existing business information has not been deleted.</p>
    </main>
  );
}
