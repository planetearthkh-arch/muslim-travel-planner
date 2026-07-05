import { readFile } from 'node:fs/promises';

const project = await readFile(new URL('../ios/App/App.xcodeproj/project.pbxproj', import.meta.url), 'utf8');
const versions = [...project.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map((match) => Number(match[1]));
if (versions.length < 2 || versions.some((version) => !Number.isInteger(version) || version < 109) || new Set(versions).size !== 1) {
  console.error('iOS build numbers must match and must be at least 109.', versions);
  process.exit(1);
}
console.log('Verified iOS build number:', versions[0]);
