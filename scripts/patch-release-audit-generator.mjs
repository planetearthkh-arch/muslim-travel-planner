import { readFile, writeFile } from 'node:fs/promises';

const path = 'scripts/apply-release-audit-fixes.mjs';
let source = await readFile(path, 'utf8');
const startMarker = "  source = exact(source,\n    `function field(name: keyof PlannerPreferences";
const endMarker = "    'required planner fields');";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error('Could not find required planner fields generator block');
const replacement = `  source = exact(source,
    '  return \\`<label>\\${label}<input data-field="\\${String(name)}" type="\\${type}" value="\\${esc(value)}" \\${placeholder ? \\`placeholder="\\${esc(placeholder)}"\\` : \'\'} /></label>\\`;',
    '  const required = [\'date\', \'time\', \'number\'].includes(type) ? \'required\' : \'\';\\n  return \\`<label>\\${label}<input data-field="\\${String(name)}" type="\\${type}" value="\\${esc(value)}" \\${required} \\${placeholder ? \\`placeholder="\\${esc(placeholder)}"\\` : \'\'} /></label>\\`;',
    'required planner fields');`;
source = source.slice(0, start) + replacement + source.slice(end + endMarker.length);
await writeFile(path, source);
