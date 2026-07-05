import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

async function findTestFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) return findTestFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.test.js') ? [fullPath] : [];
  }));
  return files.flat().sort();
}

const testFiles = await findTestFiles('dist-test');

if (!testFiles.length) {
  console.error('No compiled test files found in dist-test.');
  process.exit(1);
}

console.log(`Discovered ${testFiles.length} compiled test file${testFiles.length === 1 ? '' : 's'}.`);

const child = spawn(process.execPath, ['--test', ...testFiles], { stdio: ['ignore', 'pipe', 'pipe'] });
const lines = [];
const collect = (chunk) => {
  lines.push(...String(chunk).split(/\r?\n/));
  if (lines.length > 220) lines.splice(0, lines.length - 220);
};
child.stdout.on('data', collect);
child.stderr.on('data', collect);

child.on('exit', (code, signal) => {
  console.log(lines.join('\n'));
  if (signal) {
    console.error(`Test runner stopped by ${signal}.`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
