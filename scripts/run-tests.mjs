import { spawn } from 'node:child_process';

const testFiles = [
  'dist-test/src/prayer-spaces-global.test.js',
  'dist-test/src/prayer-spaces-jerusalem.test.js',
  'dist-test/src/planner.test.js',
];

const child = spawn(process.execPath, ['--test', ...testFiles], { stdio: 'inherit' });

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Test runner stopped by ${signal}.`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
