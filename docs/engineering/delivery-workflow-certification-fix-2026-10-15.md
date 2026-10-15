# Delivery workflow certification fixture repair — 2026-10-15

This note records two CI fixture repairs made while certifying the `codex/complete-delivery-workflows` branch.

- The driver-earning PostgreSQL integration fixture now supplies the required `createdByUserId` when creating an approved `CommissionPlan`, matching the current schema contract.
- The delivery-OTP PostgreSQL integration fixture now establishes the accepted assignment before setting `Order.currentDriverProfileId`, and clears that pointer before assignment cleanup. This preserves the deferred `currentDriverProfileId`/accepted-assignment invariant enforced by the database.

These changes are test-fixture consistency fixes; they do not relax the production dispatch invariant or payment/earning authorization rules.
