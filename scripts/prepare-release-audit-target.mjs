import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/main.ts';
let source = await readFile(path, 'utf8');
const oldText = ": ''} /></label>`;";
const newText = ": ``} /></label>`;";
if (!source.includes(oldText)) throw new Error('Could not find planner field placeholder expression');
source = source.replace(oldText, newText);
await writeFile(path, source);
