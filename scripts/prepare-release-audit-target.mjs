import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/main.ts';
let source = await readFile(path, 'utf8');
const replacements = [
  [": ''} /></label>`;", ": ``} /></label>`;", 'planner field placeholder expression'],
  ["savedTripStatus === 'failed'", "savedTripStatus === `failed`", 'trip status comparison'],
];
for (const [oldText, newText, label] of replacements) {
  if (!source.includes(oldText)) throw new Error(`Could not find ${label}`);
  source = source.replace(oldText, newText);
}
await writeFile(path, source);
