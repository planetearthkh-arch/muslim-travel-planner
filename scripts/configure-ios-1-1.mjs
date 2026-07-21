import { readFile, writeFile } from 'node:fs/promises';

const projectUrl = new URL('../ios/App/App.xcodeproj/project.pbxproj', import.meta.url);
let project = await readFile(projectUrl, 'utf8');

project = project
  .replaceAll('CURRENT_PROJECT_VERSION = 154;', 'CURRENT_PROJECT_VERSION = 156;')
  .replaceAll('CURRENT_PROJECT_VERSION = 155;', 'CURRENT_PROJECT_VERSION = 156;')
  .replaceAll('MARKETING_VERSION = 1.0.0;', 'MARKETING_VERSION = 1.1.0;');

if (!project.includes('CODE_SIGN_ENTITLEMENTS = App/App.entitlements;')) {
  const occurrences = (project.match(/CODE_SIGN_STYLE = Automatic;/g) ?? []).length;
  if (occurrences !== 2) {
    throw new Error(`Expected two iOS target signing configurations, found ${occurrences}.`);
  }
  project = project.replaceAll(
    'CODE_SIGN_STYLE = Automatic;',
    'CODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n\t\t\t\tCODE_SIGN_STYLE = Automatic;',
  );
}

const buildNumbers = [...project.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map((match) => Number(match[1]));
const marketingVersions = [...project.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((match) => match[1]);
const entitlementReferences = (project.match(/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g) ?? []).length;

if (buildNumbers.length !== 2 || buildNumbers.some((value) => value !== 156)) {
  throw new Error(`SafarMate 1.1 requires iOS build 156; found ${buildNumbers.join(', ')}.`);
}
if (marketingVersions.length !== 2 || marketingVersions.some((value) => value !== '1.1.0')) {
  throw new Error(`SafarMate 1.1 requires marketing version 1.1.0; found ${marketingVersions.join(', ')}.`);
}
if (entitlementReferences !== 2) {
  throw new Error(`Expected WeatherKit entitlements in both target configurations; found ${entitlementReferences}.`);
}

await writeFile(projectUrl, project);
console.log('Configured SafarMate iOS 1.1.0 (156) with WeatherKit entitlement.');
