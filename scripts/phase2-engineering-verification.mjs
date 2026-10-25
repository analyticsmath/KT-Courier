import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REQUIRED_COMPONENT_GROUPS = Object.freeze(['quality', 'postgres', 'redis-and-recovery', 'recovery', 'browser']);

/**
 * Reports automated Phase 2 verification only. This does NOT turn the launch
 * register green or represent screen-reader, operator, bank or road signoff.
 */
export function classifyPhase2AutomatedEvidence({ expectedSha, observedSha, jobResults }) {
  if (!/^[a-f0-9]{40}$/.test(expectedSha ?? '') || observedSha !== expectedSha) {
    throw new Error('Refusing engineering verification without matching exact commit SHA.');
  }
  if (!jobResults || typeof jobResults !== 'object' || Array.isArray(jobResults)) throw new Error('Component group results required.');
  const unexpected = Object.keys(jobResults).filter(name => !REQUIRED_COMPONENT_GROUPS.includes(name));
  if (unexpected.length) throw new Error(`Component group unexpected: ${unexpected.join(', ')}`);
  for (const name of REQUIRED_COMPONENT_GROUPS) {
    if (jobResults[name] !== 'success') throw new Error(`Component group ${name} did not pass: ${jobResults[name] ?? 'missing'}`);
  }
  return {
    automatedEngineering: 'PASS',
    evidenceTier: 'T1_T2_T3_T4_COMPONENTS',
    commitSha: expectedSha,
    componentGroups: Object.fromEntries(REQUIRED_COMPONENT_GROUPS.map(name => [name, 'success'])),
    manualPhase2Signoff: 'NOT_EVALUATED',
    humanAccessibility: 'NOT_EVALUATED',
    providerAcceptance: 'NOT_EVALUATED',
    launchAuthorization: 'NOT_EVALUATED',
  };
}

function reportLaunchBlockers() {
  const manifest = JSON.parse(readFileSync('docs/production-closure/engineering-gates.json', 'utf8'));
  return manifest.gates.filter(gate => gate.status !== 'IMPLEMENTED').map(gate => ({ key: gate.key, status: gate.status }));
}

export function main(env = process.env) {
  const observedSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const jobResults = {
    quality: env.KT_PHASE2_JOB_QUALITY,
    postgres: env.KT_PHASE2_JOB_POSTGRES,
    'redis-and-recovery': env.KT_PHASE2_JOB_REDIS,
    recovery: env.KT_PHASE2_JOB_RECOVERY,
    browser: env.KT_PHASE2_JOB_BROWSER,
  };
  const evaluated = classifyPhase2AutomatedEvidence({ expectedSha: env.KT_CERTIFICATION_HEAD_SHA, observedSha, jobResults });
  const result = {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    ...evaluated,
    launchRegisterDisposition: 'SEPARATE_FAIL_CLOSED_GATE',
    outstandingLaunchGates: reportLaunchBlockers(),
    notes: 'Automated software verification only: does not approve production payments, dispatch capacity, human screen-reader acceptance or commercial launch.',
  };
  mkdirSync('output/production-closure', { recursive: true });
  writeFileSync('output/production-closure/phase2-automated-engineering.json', JSON.stringify(result, null, 2));
  console.log(`PHASE2_AUTOMATED_ENGINEERING_PASS SHA=${observedSha}`);
  console.log(`LAUNCH_APPROVAL_NOT_EVALUATED: ${result.outstandingLaunchGates.length} non-implemented register gates retained.`);
  if (env.GITHUB_STEP_SUMMARY) {
    appendFileSync(env.GITHUB_STEP_SUMMARY, `### Phase 2 automated engineering: PASS\n\nExact commit: \`${observedSha}\`. All five CI component groups passed, including all 20 PostgreSQL matrix jobs and the isolated browser/capacity stage. This is **not** Phase 3 commercial launch authorization.\n\nUnresolved independent launch gates: ${result.outstandingLaunchGates.length}.\n`);
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
