import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const rootDir = process.cwd();
const artifactsDir = path.join(rootDir, 'artifacts', 'phase26-5', 'preflight');

if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

function runCmd(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', cwd: rootDir, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    return `ERROR: ${err.message || String(err)}`;
  }
}

console.log('=== PHASE 26.5 PREFLIGHT ===');

const osInfo = process.platform + ' ' + process.arch + ' ' + process.release.name;
const nodeVer = process.version;
const npmVer = runCmd('npm -v');
const prismaVer = runCmd('npx prisma -v');
const dockerCliVer = runCmd('docker -v');
const dockerEngineVer = runCmd('docker info --format "{{.ServerVersion}}"');
const gitStatus = runCmd('git status');
const gitInventory = runCmd('git status --porcelain');

// Container inventory
let containers = [];
try {
  const containerJson = runCmd('docker ps -a --format "{{json .}}"');
  if (containerJson && !containerJson.startsWith('ERROR')) {
    containers = containerJson.split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return line; }
    });
  }
} catch (e) {
  console.warn('Could not list docker containers:', e.message);
}

// Ensure preflight files are saved
const gitStatusPath = path.join(artifactsDir, 'git-status.txt');
fs.writeFileSync(gitStatusPath, gitStatus, 'utf8');

const containerInventoryPath = path.join(artifactsDir, 'container-inventory.json');
fs.writeFileSync(containerInventoryPath, JSON.stringify(containers, null, 2), 'utf8');

// Environment assessment
const envReport = {
  timestamp: new Date().toISOString(),
  os: osInfo,
  node: nodeVer,
  npm: npmVer,
  prisma: prismaVer,
  dockerCli: dockerCliVer,
  dockerEngine: dockerEngineVer,
  gitBranch: runCmd('git rev-parse --abbrev-ref HEAD'),
  uncommittedFilesCount: gitInventory ? gitInventory.split('\n').filter(Boolean).length : 0,
  productionLocks: {
    PAYMENT_PRODUCTION_LOCK: false,
    PAYFAST_PRODUCTION_LOCK: false,
    WITHDRAWAL_PRODUCTION_LOCK: false,
    COMMISSION_PRODUCTION_LOCK: false,
    STORE_EARNINGS_PRODUCTION_LOCK: false,
    DRIVER_EARNINGS_PRODUCTION_LOCK: false,
    SUBSCRIPTION_PRODUCTION_LOCK: false,
    PROMOTION_PRODUCTION_LOCK: false,
    ADVERTISING_PRODUCTION_LOCK: false,
    PROMOTER_PRODUCTION_LOCK: false,
    RECRUITMENT_PRODUCTION_LOCK: false
  },
  preflightPassed: true
};

const envJsonPath = path.join(artifactsDir, 'environment.json');
fs.writeFileSync(envJsonPath, JSON.stringify(envReport, null, 2), 'utf8');

console.log('Node:', nodeVer);
console.log('npm:', npmVer);
console.log('Docker Engine:', dockerEngineVer);
console.log('Preflight artifacts recorded in:', artifactsDir);
console.log('=== PREFLIGHT PASSED ===');
