import { notFound } from "next/navigation";
import { SignatureHomepageKeyframes } from "@/components/public-v2/home/SignatureHomepageKeyframes";

export const metadata = { robots: { index: false, follow: false }, title: "KT Home V4 keyframes" };

export default function KtHomeV4KeyframePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <SignatureHomepageKeyframes />;
}
