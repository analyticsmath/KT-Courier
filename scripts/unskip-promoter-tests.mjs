import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'tests/integration');
const files = readdirSync(dir).filter(f => f.startsWith('promoter-') && f.endsWith('.integration.test.ts'));

for (const file of files) {
  const filePath = join(dir, file);
  let content = readFileSync(filePath, 'utf8');
  if (content.includes('describe.skip')) {
    content = content.replace('describe.skip', 'describe');
    writeFileSync(filePath, content, 'utf8');
    console.log(`Unskipped ${file}`);
  }
}
