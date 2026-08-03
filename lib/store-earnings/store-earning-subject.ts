import { StoreEarningError } from "./errors";

export const STORE_EARNING_SUBJECT_TYPES = ["MARKETPLACE_ORDER"] as const;
export type StoreEarningSubjectTypeCode = (typeof STORE_EARNING_SUBJECT_TYPES)[number];

export type StoreEarningSubject = Readonly<{
  subjectType: StoreEarningSubjectTypeCode;
  subjectId: string;
  subjectPublicReference: string;
  settlementReference: string;
  settlementVersion: string;
}>;

export function assertStoreEarningSubject(subject: StoreEarningSubject): void {
  const values = [subject.subjectId, subject.subjectPublicReference, subject.settlementReference, subject.settlementVersion];
  if (subject.subjectType !== "MARKETPLACE_ORDER" || values.some((value) => !value.trim() || value.length > 160)) {
    throw new StoreEarningError("STORE_EARNING_INVALID_SNAPSHOT", "The authoritative store earning subject identity is invalid.");
  }
}
