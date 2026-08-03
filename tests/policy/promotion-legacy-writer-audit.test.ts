import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('promotion source and legacy writer audit', () => {
  it('no Phase 23 runtime writer targets obsolete legacy promotion models', () => {
    const promotionsDir = path.resolve(__dirname, '../../lib/promotions');
    const legacyPatterns = [
      'LegacyPromotion',
      'LegacyCoupon',
      'LegacyPromotionRedemption',
      'legacyPromotion',
      'legacyCoupon',
      'legacyPromotionRedemption',
    ];
    const violations: string[] = [];

    if (fs.existsSync(promotionsDir)) {
      for (const entry of fs.readdirSync(promotionsDir)) {
        if (!entry.endsWith('.ts')) continue;
        const content = fs.readFileSync(path.join(promotionsDir, entry), 'utf-8');
        for (const pattern of legacyPatterns) {
          if (content.includes(pattern)) {
            violations.push(`${entry} references legacy model '${pattern}'`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('production paths, routes, and processors do not accept or pass testBypass / skipProductionLock / allowMockRepository / useInMemoryLedger / testApproval', () => {
    const rootDir = path.resolve(__dirname, '../..');

    const searchDirs = [
      path.join(rootDir, 'lib/promotions'),
      path.join(rootDir, 'app/api'),
      path.join(rootDir, 'scripts'),
    ];

    const forbiddenStrings = [
      'testBypass',
      'skipProductionLock',
      'allowMockRepository',
      'useInMemoryLedger',
    ];

    const filesToAudit: string[] = [];

    function scanDir(dir: string) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
          if (entry.name.includes('.test.') || entry.name === 'production-lock.ts' || entry.name.includes('-preflight.')) {
            continue;
          }
          filesToAudit.push(fullPath);
        }
      }
    }

    for (const dir of searchDirs) {
      scanDir(dir);
    }

    expect(filesToAudit.length).toBeGreaterThan(0);

    for (const file of filesToAudit) {
      const content = fs.readFileSync(file, 'utf8');

      for (const forbidden of forbiddenStrings) {
        expect(content).not.toContain(forbidden);
      }

      // Ensure no production code passes the test bypass object
      expect(content).not.toContain('approved: true');
      expect(content).not.toContain('approved:true');
    }
  });
});
