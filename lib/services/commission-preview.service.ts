import { calculateCommission, type CommissionBeneficiarySnapshot } from "@/lib/commissions/commission-calculator";
import type { CommissionBasisSnapshot } from "@/lib/commissions/commission-basis";

export function previewCommissionPlan(input: Readonly<{
  plan: { basisType: "ORDER_SUBTOTAL" | "ORDER_TOTAL"; calculationVersion: string; rules: Parameters<typeof calculateCommission>[0]["rules"] };
  basis: CommissionBasisSnapshot;
  beneficiaries?: readonly CommissionBeneficiarySnapshot[];
}>) {
  return calculateCommission({ basis: input.basis, basisType: input.plan.basisType, calculationVersion: input.plan.calculationVersion, rules: input.plan.rules, beneficiaries: input.beneficiaries });
}
