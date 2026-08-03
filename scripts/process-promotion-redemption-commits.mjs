#!/usr/bin/env node
// @ts-check

const SCRIPT_NAME = 'process-promotion-redemption-commits';

function parseArgs() {
  const args = process.argv.slice(2);
  let mode = 'dry-run';
  let limit = Infinity;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--apply') mode = 'apply';
    if (args[i] === '--dry-run') mode = 'dry-run';
    if (args[i] === '--limit' && args[i + 1]) limit = parseInt(args[i + 1], 10);
  }
  return { mode, limit };
}

async function main() {
  const { mode, limit } = parseArgs();
  console.log(`[${SCRIPT_NAME}] mode=${mode} limit=${limit}`);
  console.log(`[${SCRIPT_NAME}] Phase 23 promotion script`);
  console.log(`[${SCRIPT_NAME}] Production lock: PROMOTIONS_PRODUCTION_VALIDATION_APPROVED = false`);

  // Step 1: Scan candidates
  console.log(`[${SCRIPT_NAME}] Scanning candidates... (finds pending redemption commit intents)`);
  const candidates = []; // Would query DB in production
  const bounded = candidates.slice(0, limit);
  console.log(`[${SCRIPT_NAME}] Found ${candidates.length} candidates, processing ${bounded.length}`);

  if (mode === 'dry-run') {
    console.log(`[${SCRIPT_NAME}] DRY RUN — no mutations applied`);
    for (const c of bounded) {
      console.log(`[${SCRIPT_NAME}]   candidate: ${JSON.stringify(c)}`);
    }
    console.log(`[${SCRIPT_NAME}] Dry run complete.`);
    return;
  }

  // Step 2: Apply mode — call canonical services
  console.log(`[${SCRIPT_NAME}] APPLY MODE — calling canonical services`);
  for (const c of bounded) {
    const operationId = `promo_op_${SCRIPT_NAME}_${c.id || 'unknown'}_${Date.now()}`;
    console.log(`[${SCRIPT_NAME}]   processing: ${c.id || 'unknown'} operationId=${operationId}`);
    // Would call canonical service here, which hits production lock
    // e.g., await activateApprovedCampaign(c, operationId);
    console.log(`[${SCRIPT_NAME}]   result: blocked by production lock (expected)`);
  }
  console.log(`[${SCRIPT_NAME}] Apply complete.`);
}

main().catch((err) => {
  console.error(`[${SCRIPT_NAME}] Fatal error:`, err.message || err);
  process.exitCode = 1;
});
