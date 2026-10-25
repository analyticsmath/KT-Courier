import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { classifyPhase2AutomatedEvidence } from './phase2-engineering-verification.mjs';

const sha = 'a'.repeat(40);
const jobs = {
  quality: 'success', postgres: 'success', 'redis-and-recovery': 'success',
  recovery: 'success', browser: 'success',
};

test('five complete exact-source component groups produce engineering-only automated acceptance', () => {
  const result = classifyPhase2AutomatedEvidence({ expectedSha: sha, observedSha: sha, jobResults: jobs });
  assert.equal(result.automatedEngineering, 'PASS');
  assert.equal(result.launchAuthorization, 'NOT_EVALUATED');
  assert.equal(result.humanAccessibility, 'NOT_EVALUATED');
  assert.equal(result.providerAcceptance, 'NOT_EVALUATED');
  assert.equal(result.manualPhase2Signoff, 'NOT_EVALUATED');
});

test('no shortcut: missing, skipped or failed groups and wrong SHA cannot pass', () => {
  for (const result of ['failure', 'cancelled', 'skipped', 'neutral', 'in_progress']) {
    const bad = { ...jobs, browser: result };
    assert.throws(() => classifyPhase2AutomatedEvidence({ expectedSha: sha, observedSha: sha, jobResults: bad }), /group.*browser/i);
  }
  assert.throws(() => classifyPhase2AutomatedEvidence({ expectedSha: sha, observedSha: 'b'.repeat(40), jobResults: jobs }), /exact.*sha/i);
  assert.throws(() => classifyPhase2AutomatedEvidence({ expectedSha: sha, observedSha: sha, jobResults: { ...jobs, surprise: 'success' } }), /group.*unexpected/i);
  assert.throws(() => classifyPhase2AutomatedEvidence({ expectedSha: sha, observedSha: sha, jobResults: { ...jobs, postgres: undefined } }), /group.*postgres/i);
});

test('workflow exposes an independent green automated phase 2 milestone without weakening launch veto', () => {
  const workflow = yaml.load(readFileSync('.github/workflows/production-certification.yml', 'utf8'));
  const job = workflow.jobs['phase2-automated'];
  assert.deepEqual(job.needs, ['quality', 'postgres', 'redis-and-recovery', 'recovery', 'browser']);
  assert.equal(job.steps[0].with.ref, '${{ env.KT_CERTIFICATION_HEAD_SHA }}');
  assert.match(job.steps.find(s=>s.run?.includes('phase2-engineering-verification.mjs')).run, /phase2-engineering-verification\.mjs/);
  assert.ok(workflow.jobs.certified.needs.includes('phase2-automated'));
  assert.ok(workflow.jobs.certified.steps.some(s=>s.run?.includes('check-closure-engineering-gates.mjs')));
  assert.ok(!JSON.stringify(workflow.jobs).includes('continue-on-error'));
});

test('launch veto still exits nonzero for unresolved commercial and operational gates', async () => {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, ['scripts/check-closure-engineering-gates.mjs'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /NOT_READY: unresolved launch register gates/);
  assert.match(r.stderr, /commercial_financial_certification/);
  assert.match(r.stderr, /fresh_production_protected_row_audit/);
});
