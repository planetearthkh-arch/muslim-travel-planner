import { readFile } from 'node:fs/promises';

const [project, plist] = await Promise.all([
  readFile(new URL('../ios/App/App.xcodeproj/project.pbxproj', import.meta.url), 'utf8'),
  readFile(new URL('../ios/App/App/Info.plist', import.meta.url), 'utf8'),
]);

const projectVersions = [...project.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map((match) => Number(match[1]));
if (projectVersions.length < 2 || projectVersions.some((version) => !Number.isInteger(version) || version < 119) || new Set(projectVersions).size !== 1) {
  console.error('iOS project build numbers must match and must be at least 119.', projectVersions);
  process.exit(1);
}

const bundleVersionMatch = plist.match(/<key>CFBundleVersion<\/key>\s*<string>([^<]+)<\/string>/);
if (!bundleVersionMatch) {
  console.error('Info.plist must define CFBundleVersion.');
  process.exit(1);
}

const configuredBundleVersion = bundleVersionMatch[1].trim();
const effectiveBuildNumber = configuredBundleVersion === '$(CURRENT_PROJECT_VERSION)'
  ? projectVersions[0]
  : Number(configuredBundleVersion);

if (!Number.isInteger(effectiveBuildNumber) || effectiveBuildNumber < 153) {
  console.error('The effective iOS bundle build number must be at least 153.', effectiveBuildNumber);
  process.exit(1);
}

console.log('Verified effective iOS build number:', effectiveBuildNumber);
