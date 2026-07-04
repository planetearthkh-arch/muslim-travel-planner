import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, content) => writeFileSync(path, content.endsWith('\n') ? content : `${content}\n`);

function replaceAllExact(path, search, replacement, expectedMinimum = 1) {
  const source = read(path);
  const count = source.split(search).length - 1;
  if (count < expectedMinimum) throw new Error(`${path}: expected at least ${expectedMinimum} occurrences of ${search}, found ${count}`);
  write(path, source.split(search).join(replacement));
  console.log(`updated ${path}: ${count} replacement(s)`);
}

function replaceOnce(path, search, replacement) {
  const source = read(path);
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${path}: expected exactly one occurrence of ${search}, found ${count}`);
  write(path, source.replace(search, replacement));
  console.log(`updated ${path}`);
}

const ciPath = '.github/workflows/ci.yml';
replaceAllExact(ciPath, '- run: npm install', '- run: npm ci', 2);
const ci = read(ciPath);
if (!ci.includes('      - run: npm run lint\n')) {
  replaceOnce(ciPath, '      - run: npm test\n', '      - run: npm test\n      - run: npm run lint\n');
}

console.log('phase 2 patch completed');
