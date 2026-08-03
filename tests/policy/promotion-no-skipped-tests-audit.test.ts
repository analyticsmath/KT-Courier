import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('promotion test skip audit', () => {
  const APPROVED_SKIP_PATTERNS = [
    'tests/integration/',
    'tests/e2e/',
    'tests/database/',
  ];

  const scanDir = (dir: string): string[] => {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) results.push(...scanDir(fullPath));
      else if (entry.name.includes('promotion') && entry.name.endsWith('.test.ts')) results.push(fullPath);
    }
    return results;
  };

  it('no promotion test files contain it.skip, test.skip, describe.skip, it.todo, or test.todo', () => {
    const testRoot = path.resolve(__dirname, '..');
    const allFiles = scanDir(testRoot);
    const violations: string[] = [];
    const skipPatterns = ['it.skip', 'test.skip', 'describe.skip', 'it.todo', 'test.todo'];

    for (const file of allFiles) {
      const relPath = path.relative(testRoot, file).replace(/\\/g, '/');
      if (relPath === 'policy/promotion-no-skipped-tests-audit.test.ts') continue;
      if (APPROVED_SKIP_PATTERNS.some(p => relPath.startsWith(p))) continue;
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of skipPatterns) {
        if (content.includes(pattern)) {
          violations.push(`${relPath} contains '${pattern}'`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
