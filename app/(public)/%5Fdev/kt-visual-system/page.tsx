import { notFound } from "next/navigation";
import { VisualLab } from "@/components/public-v2/lab/VisualLab";

export const metadata = { robots: { index: false, follow: false }, title: "KT visual lab" };

export default function KtVisualSystemLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <VisualLab />;
}
