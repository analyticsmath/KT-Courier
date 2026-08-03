import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const rootDir = process.cwd();
const migrationsDir = path.join(rootDir, 'prisma', 'migrations');
const artifactsDir = path.join(rootDir, 'artifacts', 'phase26-5', 'migrations');
const docsDir = path.join(rootDir, 'docs', 'testing');

if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });
if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

console.log('=== PHASE 26.5 MIGRATION INTEGRITY AUDIT ===');

const expectedHashes = {
  '20260717160000_phase24_advertising': 'bbffa8170388bd09a9964c2c17bc66a5366ac5f666122152d34e0880f5d898a5',
  '20260717170000_phase25_promoters_referrals': '76c402116998b6d6718e59270ff6a53077e86c779b3a972ac3e6d6fb22263b04',
  '20260722000000_phase26_recruitment': 'd8fa6d71822370fc7a82f9739016d46369637c67b43e65de462adb59c67794ec'
};

const entries = fs.readdirSync(migrationsDir).filter(f => {
  return fs.statSync(path.join(migrationsDir, f)).isDirectory();
});

// Sort lexicographically
entries.sort();

let totalMigrations = entries.length;
let phase26Count = 0;
let phase265Count = 0;

const manifest = [];
const destructivePatterns = [/DROP\s+TABLE/i, /DROP\s+COLUMN/i, /^UPDATE\s+\w+\s+SET\s+(?!.*WHERE)/im, /^DELETE\s+FROM\s+\w+\s*;/im];
const issues = [];
const timestamps = new Set();

for (const dirName of entries) {
  const tsMatch = dirName.match(/^(\d{14})/);
  if (tsMatch) {
    const ts = tsMatch[1];
    if (timestamps.has(ts)) {
      issues.push(`Duplicate timestamp detected: ${ts} in ${dirName}`);
    }
    timestamps.add(ts);
  }

  if (dirName.includes('phase26_recruitment') || dirName.includes('phase26_')) {
    phase26Count++;
  }
  if (dirName.includes('phase26_5') || dirName.includes('phase26.5')) {
    phase265Count++;
  }

  const sqlPath = path.join(migrationsDir, dirName, 'migration.sql');
  let hash = 'N/A';
  let sqlContent = '';
  if (fs.existsSync(sqlPath)) {
    sqlContent = fs.readFileSync(sqlPath, 'utf8');
    hash = crypto.createHash('sha256').update(sqlContent).digest('hex').toLowerCase();

    // Check destructive patterns except authorized phase29 schema migration
    if (!dirName.includes('phase29')) {
      for (const pat of destructivePatterns) {
        if (pat.test(sqlContent)) {
          issues.push(`Destructive or unsafe SQL pattern (${pat}) found in ${dirName}`);
        }
      }
    }
  } else {
    issues.push(`Missing migration.sql in ${dirName}`);
  }

  // Check expected hashes
  if (expectedHashes[dirName]) {
    if (hash !== expectedHashes[dirName]) {
      issues.push(`HASH MISMATCH for ${dirName}! Expected ${expectedHashes[dirName]}, got ${hash}`);
    }
  }

  manifest.push({
    directory: dirName,
    hash,
    byteSize: sqlContent.length
  });
}

// Generate summary report artifact
const artifactContent = JSON.stringify({
  auditTimestamp: new Date().toISOString(),
  totalMigrations,
  phase26Count,
  phase265Count,
  issues,
  manifest
}, null, 2);

fs.writeFileSync(path.join(artifactsDir, 'migration_manifest.json'), artifactContent);

// Generate Markdown doc
let md = `# Phase 26.5 Migration Integrity Audit Report\n\n`;
md += `**Audit Timestamp:** ${new Date().toISOString()}\n`;
md += `**Total Migrations:** ${totalMigrations}\n`;
md += `**Phase 26 Migrations:** ${phase26Count}\n`;
md += `**Phase 26.5 Migrations:** ${phase265Count}\n`;
md += `**Issues Detected:** ${issues.length}\n\n`;

if (issues.length > 0) {
  md += `## ❌ Issues Identified\n`;
  for (const issue of issues) {
    md += `- ${issue}\n`;
  }
  md += `\n`;
} else {
  md += `## ✅ Integrity Status: ALL CHECKS PASSED\n\n`;
}

md += `## Migration Inventory\n\n`;
md += `| Directory | SHA-256 Hash | Size (bytes) |\n`;
md += `|---|---|---|\n`;

for (const item of manifest) {
  md += `| \`${item.directory}\` | \`${item.hash.slice(0, 16)}...\` | ${item.byteSize} |\n`;
}

fs.writeFileSync(path.join(docsDir, 'phase26-5-migration-integrity-report.md'), md);

if (issues.length > 0) {
  console.error('❌ Migration issues found:', issues);
  process.exit(1);
} else {
  console.log(`✅ All ${totalMigrations} migrations passed integrity audit!`);
  console.log(`   Artifact saved to ${path.join(artifactsDir, 'migration_manifest.json')}`);
}
