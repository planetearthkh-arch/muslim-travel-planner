import { readFile, writeFile } from 'node:fs/promises';

const mainPath = 'src/main.ts';
let mainSource = await readFile(mainPath, 'utf8');
const replacements = [
  [": ''} /></label>`;", ": ``} /></label>`;", 'planner field placeholder expression'],
  ["savedTripStatus === 'failed'", "savedTripStatus === `failed`", 'trip status comparison'],
];
for (const [oldText, newText, label] of replacements) {
  if (!mainSource.includes(oldText)) throw new Error(`Could not find ${label}`);
  mainSource = mainSource.replace(oldText, newText);
}
await writeFile(mainPath, mainSource);

const generatorPath = 'scripts/apply-release-audit-fixes.mjs';
let generator = await readFile(generatorPath, 'utf8');
const toggleStartMarker = "  source = exact(source,\n    `  document.querySelectorAll<HTMLButtonElement>('[data-attraction-save]')";
const toggleEndMarker = "    'saved attraction toggle');";
const toggleStart = generator.indexOf(toggleStartMarker);
const toggleEnd = generator.indexOf(toggleEndMarker, toggleStart);
if (toggleStart < 0 || toggleEnd < 0) throw new Error('Could not find saved attraction toggle generator block');
const toggleBlockEnd = toggleEnd + toggleEndMarker.length;
const toggleBlock = generator.slice(toggleStart, toggleBlockEnd);
if (!toggleBlock.includes('savedAttractionIds.has(')) throw new Error('Saved attraction toggle block is already patched unexpectedly');
const patchedToggleBlock = toggleBlock.replaceAll('savedAttractionIds.has(', 'savedAttractions.has(');
generator = generator.slice(0, toggleStart) + patchedToggleBlock + generator.slice(toggleBlockEnd);
await writeFile(generatorPath, generator);
