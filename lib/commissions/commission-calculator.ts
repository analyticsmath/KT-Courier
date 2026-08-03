import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { selectCommissionBasis, type CommissionBasisSnapshot, type CommissionBasisTypeCode } from "./commission-basis";
import { CommissionError } from "./errors";

const Decimal = Prisma.Decimal;

export type CommissionCalculationRule = Readonly<{
  id: string;
  publicReference: string;
  ruleCode: string;
  priority: number;
  allocationType: "PLATFORM_COMMISSION_REVENUE" | "BENEFICIARY_COMMISSION_PAYABLE";
  beneficiaryType: "PLATFORM" | "PROMOTER";
  calculationMethod: "PERCENTAGE_BPS" | "FIXED_AMOUNT";
  rateBasisPoints: number | null;
  fixedAmount: Prisma.Decimal | null;
  minimumAmount: Prisma.Decimal | null;
  maximumAmount: Prisma.Decimal | null;
  isRequired: boolean;
}>;

export type CommissionBeneficiarySnapshot = Readonly<{
  beneficiaryType: "PROMOTER";
  ownerId: string;
  walletId: string;
  commissionPayableAccountId: string;
  attributionReference: string;
  attributionVersion: string;
}>;

export type CalculatedCommissionComponent = Readonly<{
  ruleId: string;
  rulePublicReference: string;
  ruleCode: string;
  allocationType: CommissionCalculationRule["allocationType"];
  beneficiaryType: CommissionCalculationRule["beneficiaryType"];
  beneficiary: CommissionBeneficiarySnapshot | null;
  amount: string;
}>;

export type CommissionCalculation = Readonly<{
  basisType: CommissionBasisTypeCode;
  basisAmount: string;
  totalAmount: string;
  components: readonly CalculatedCommissionComponent[];
  calculationHash: string;
}>;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(",")}}`;
}

function rounded(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function calculateRuleAmount(rule: CommissionCalculationRule, basis: Prisma.Decimal): Prisma.Decimal {
  let amount: Prisma.Decimal;
  if (rule.calculationMethod === "PERCENTAGE_BPS") {
    if (!Number.isInteger(rule.rateBasisPoints) || rule.rateBasisPoints! < 0 || rule.rateBasisPoints! > 10_000 || rule.fixedAmount) {
      throw new CommissionError("COMMISSION_INVALID_RULE", `Rule ${rule.ruleCode} has an invalid basis-point shape.`);
    }
    amount = basis.mul(new Decimal(rule.rateBasisPoints!)).div(10_000);
  } else {
    if (!rule.fixedAmount || rule.rateBasisPoints !== null) throw new CommissionError("COMMISSION_INVALID_RULE", `Rule ${rule.ruleCode} has an invalid fixed amount shape.`);
    amount = new Decimal(rule.fixedAmount);
  }
  if (rule.minimumAmount) amount = Decimal.max(amount, rule.minimumAmount);
  if (rule.maximumAmount) amount = Decimal.min(amount, rule.maximumAmount);
  if (amount.lessThan(0) || !amount.isFinite() || amount.isNaN()) throw new CommissionError("COMMISSION_INVALID_RULE", `Rule ${rule.ruleCode} produces an invalid amount.`);
  return rounded(amount);
}

export function calculateCommission(input: Readonly<{
  basis: CommissionBasisSnapshot;
  basisType: CommissionBasisTypeCode;
  calculationVersion: string;
  rules: readonly CommissionCalculationRule[];
  beneficiaries?: readonly CommissionBeneficiarySnapshot[];
}>): CommissionCalculation {
  const basis = selectCommissionBasis(input.basis, input.basisType);
  const beneficiaryByType = new Map((input.beneficiaries ?? []).map((beneficiary) => [beneficiary.beneficiaryType, beneficiary]));
  const components: CalculatedCommissionComponent[] = [];
  const rules = [...input.rules].sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));
  const codes = new Set<string>();
  let total = new Decimal(0);
  for (const rule of rules) {
    if (codes.has(rule.ruleCode)) throw new CommissionError("COMMISSION_INVALID_RULE", "Commission rule codes must be unique in a plan.");
    codes.add(rule.ruleCode);
    if ((rule.allocationType === "PLATFORM_COMMISSION_REVENUE") !== (rule.beneficiaryType === "PLATFORM")) {
      throw new CommissionError("COMMISSION_INVALID_RULE", `Rule ${rule.ruleCode} has incompatible allocation and beneficiary semantics.`);
    }
    const beneficiary = rule.beneficiaryType === "PROMOTER" ? beneficiaryByType.get("PROMOTER") ?? null : null;
    if (rule.beneficiaryType === "PROMOTER" && !beneficiary) {
      if (rule.isRequired) throw new CommissionError("COMMISSION_BENEFICIARY_REQUIRED", `Rule ${rule.ruleCode} requires a verified promoter beneficiary.`);
      continue;
    }
    const amount = calculateRuleAmount(rule, basis);
    if (amount.isZero()) continue;
    total = total.add(amount);
    components.push(Object.freeze({ ruleId: rule.id, rulePublicReference: rule.publicReference, ruleCode: rule.ruleCode, allocationType: rule.allocationType, beneficiaryType: rule.beneficiaryType, beneficiary, amount: amount.toFixed(2) }));
  }
  if (components.length === 0 || total.greaterThan(basis)) throw new CommissionError("COMMISSION_TOTAL_EXCEEDS_BASIS", "Commission components must be positive and may not exceed the selected basis.");
  const hashPayload = Object.freeze({ basis: input.basis, basisType: input.basisType, calculationVersion: input.calculationVersion, components: components.map((component) => ({ ...component, beneficiary: component.beneficiary ? { ownerId: component.beneficiary.ownerId, walletId: component.beneficiary.walletId, commissionPayableAccountId: component.beneficiary.commissionPayableAccountId, attributionReference: component.beneficiary.attributionReference, attributionVersion: component.beneficiary.attributionVersion } : null })) });
  return Object.freeze({ basisType: input.basisType, basisAmount: basis.toFixed(2), totalAmount: total.toFixed(2), components: Object.freeze(components), calculationHash: createHash("sha256").update(canonicalJson(hashPayload)).digest("hex") });
}

export function hashCommissionCommand(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}
