import { DriverEarningError } from "./errors";
import { formatDriverEarningMoney, parseDriverEarningMoney } from "./driver-earning-money";
import { assertDriverEarningSubject } from "./driver-earning-subject";

export type DriverCommissionChargeSnapshot = Readonly<{ commissionAllocationId: string; commissionAllocationPublicReference: string; amount: string; currency: "ZAR" }>;
export type DriverSettlementSnapshot = Readonly<{
  subjectType: "COURIER_DELIVERY"; subjectId: string; subjectPublicReference: string;
  assignmentId: string; assignmentPublicReference: string; assignmentVersion: string;
  driverId: string; driverPublicReference: string; walletId: string;
  orderId: string; orderPublicReference: string; paymentId: string; paymentPublicReference: string;
  settlementReference: string; settlementVersion: string; calculationVersion: string;
  completionEvidenceReference: string; serviceCompletedAt: string; authoritativeAt: string; releaseEligibleAt: string | null;
  driverSettlementBasisAmount: string; attributedCommissionAmount: string; netDriverEarningAmount: string;
  currency: "ZAR"; commissionCharges: readonly DriverCommissionChargeSnapshot[];
}>;

const REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const iso = (value: string) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

export function validateDriverSettlementSnapshot(snapshot: DriverSettlementSnapshot): DriverSettlementSnapshot {
  assertDriverEarningSubject(snapshot);
  const refs = [snapshot.driverId, snapshot.driverPublicReference, snapshot.walletId, snapshot.orderId, snapshot.orderPublicReference, snapshot.paymentId, snapshot.paymentPublicReference, snapshot.settlementReference, snapshot.settlementVersion, snapshot.calculationVersion, snapshot.completionEvidenceReference];
  if (!refs.every((value) => REF.test(value)) || snapshot.currency !== "ZAR" || !iso(snapshot.serviceCompletedAt) || !iso(snapshot.authoritativeAt) || (snapshot.releaseEligibleAt !== null && !iso(snapshot.releaseEligibleAt))) throw new DriverEarningError("DRIVER_EARNING_INVALID_SNAPSHOT", "Driver settlement identity, currency, or timestamp evidence is invalid.");
  if (Date.parse(snapshot.authoritativeAt) < Date.parse(snapshot.serviceCompletedAt) || (snapshot.releaseEligibleAt && Date.parse(snapshot.releaseEligibleAt) < Date.parse(snapshot.serviceCompletedAt))) throw new DriverEarningError("DRIVER_EARNING_INVALID_SNAPSHOT", "Settlement authority or release eligibility predates service completion.");
  const basis = parseDriverEarningMoney(snapshot.driverSettlementBasisAmount);
  const commission = parseDriverEarningMoney(snapshot.attributedCommissionAmount, { allowZero: true });
  const net = parseDriverEarningMoney(snapshot.netDriverEarningAmount);
  if (!basis.sub(commission).equals(net)) throw new DriverEarningError("DRIVER_EARNING_INVALID_SNAPSHOT", "Driver basis minus attributed commission must equal the net earning.");
  const seen = new Set<string>();
  const charges = [...snapshot.commissionCharges].map((charge) => {
    if (!REF.test(charge.commissionAllocationId) || !REF.test(charge.commissionAllocationPublicReference) || charge.currency !== "ZAR" || seen.has(charge.commissionAllocationId)) throw new DriverEarningError("DRIVER_EARNING_COMMISSION_INVALID", "Driver commission charge identity is invalid or duplicated.");
    seen.add(charge.commissionAllocationId);
    return Object.freeze({ ...charge, amount: formatDriverEarningMoney(parseDriverEarningMoney(charge.amount)) });
  }).sort((a, b) => a.commissionAllocationId.localeCompare(b.commissionAllocationId));
  const chargeTotal = charges.reduce((sum, charge) => sum.add(charge.amount), parseDriverEarningMoney("0.00", { allowZero: true }));
  if (!chargeTotal.equals(commission)) throw new DriverEarningError("DRIVER_EARNING_COMMISSION_INVALID", "Commission charge sum must equal attributed commission.");
  return Object.freeze({ ...snapshot, driverSettlementBasisAmount: formatDriverEarningMoney(basis), attributedCommissionAmount: formatDriverEarningMoney(commission), netDriverEarningAmount: formatDriverEarningMoney(net), commissionCharges: Object.freeze(charges) });
}
