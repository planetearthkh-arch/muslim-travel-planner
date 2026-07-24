import { readFile } from 'node:fs/promises';

const [project, plist] = await Promise.all([
  readFile(new URL('../ios/App/App.xcodeproj/project.pbxproj', import.meta.url), 'utf8'),
  readFile(new URL('../ios/App/App/Info.plist', import.meta.url), 'utf8'),
]);

const projectVersions = [...project.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map((match) => Number(match[1]));
if (projectVersions.length !== 2 || projectVersions.some((version) => version !== 160)) {
  console.error('SafarMate 1.1 requires matching iOS project build numbers of 160.', projectVersions);
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

if (effectiveBuildNumber !== 160) {
  console.error('The effective SafarMate iOS bundle build number must be 160.', effectiveBuildNumber);
  process.exit(1);
}

console.log('Verified effective iOS build number:', effectiveBuildNumber);
