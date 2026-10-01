import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { BusinessInvitation } from "@/components/forms/BusinessInvitation";
export const metadata = {
  title: "Business invitation",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) notFound();
  const user = await getCurrentUser();
  return (
    <article className="max-w-2xl mx-auto px-6 py-20">
      <h1 className="text-4xl mb-8">Join your business team.</h1>
      <BusinessInvitation token={token} signedIn={!!user} />
    </article>
  );
}
