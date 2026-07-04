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
let output = '';
child.stdout.on('data', (chunk) => { output += chunk.toString(); });
child.stderr.on('data', (chunk) => { output += chunk.toString(); });

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Test runner stopped by ${signal}.`);
    process.exit(1);
  }
  if (code === 0) {
    console.log(output);
    process.exit(0);
  }
  const lines = output.trimEnd().split('\n');
  console.error(lines.slice(-240).join('\n'));
  process.exit(code ?? 1);
});
