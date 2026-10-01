import { BusinessPromotionFinancialView } from "@/components/protected-v2/store/BusinessPromotionFinancialView";
export default async function Page({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  return (
    <BusinessPromotionFinancialView
      reference={(await params).reference}
      section="budget"
    />
  );
}
