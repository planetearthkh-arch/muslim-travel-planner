import { readFile, writeFile } from 'node:fs/promises';

const text = await readFile('test-failure.log', 'utf8');
const lines = text.split(/\r?\n/);
const failures = lines.filter((line) => /^not ok\s+\d+\s+-\s+/.test(line));
await writeFile('failure-summary.txt', `${failures.join('\n')}\n`);
console.log(`Summarized ${failures.length} failures.`);
