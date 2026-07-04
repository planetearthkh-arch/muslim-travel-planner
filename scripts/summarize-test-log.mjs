import { readFile, writeFile } from 'node:fs/promises';

const text = await readFile('test-failure.log', 'utf8');
const lines = text.split(/\r?\n/);
const failureStarts = [];
for (let index = 0; index < lines.length; index += 1) {
  if (/^not ok\s+\d+\s+-\s+/.test(lines[index])) failureStarts.push(index);
}
const blocks = failureStarts.map((start, failureIndex) => {
  const end = failureIndex + 1 < failureStarts.length ? failureStarts[failureIndex + 1] : lines.length;
  const nextSubtest = lines.slice(start + 1, end).findIndex((line) => /^# Subtest:/.test(line));
  const blockEnd = nextSubtest >= 0 ? start + 1 + nextSubtest : Math.min(end, start + 80);
  return lines.slice(start, blockEnd).join('\n');
});
await writeFile('failure-summary.txt', `${blocks.join('\n\n---\n\n')}\n`);
console.log(`Summarized ${blocks.length} failures.`);
