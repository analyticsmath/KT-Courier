#!/usr/bin/env node
// This legacy entry point checks reserved-budget reconciliation using the
// same bounded database scan as the operator reconciliation command.
console.log("Checking promotion reserved-budget reconciliation; other invariants require their own checks.");
await import("./scan-promotion-reconciliation.mjs");
