import { readFile, writeFile } from 'node:fs/promises';

const projectUrl = new URL('../ios/App/App.xcodeproj/project.pbxproj', import.meta.url);
const plistUrl = new URL('../ios/App/App/Info.plist', import.meta.url);
let [project, plist] = await Promise.all([
  readFile(projectUrl, 'utf8'),
  readFile(plistUrl, 'utf8'),
]);

for (const previousBuild of [154, 155, 156, 157, 158, 159]) {
  project = project.replaceAll(
    `CURRENT_PROJECT_VERSION = ${previousBuild};`,
    'CURRENT_PROJECT_VERSION = 160;',
  );
}
project = project.replaceAll('MARKETING_VERSION = 1.0.0;', 'MARKETING_VERSION = 1.1.0;');

plist = plist.replace(
  /(<key>CFBundleVersion<\/key>\s*<string>)[^<]+(<\/string>)/,
  '$1$(CURRENT_PROJECT_VERSION)$2',
);

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

const verificationPhaseReference = 'B00101002D2D000000000001 /* Verify Native Web Assets */';
if (!project.includes('name = "Verify Native Web Assets";')) {
  const buildPhasesAnchor = [
    '\t\t\tbuildPhases = (',
    '\t\t\t\t504EC3001FED79650016851F /* Sources */,',
  ].join('\n');
  if (!project.includes(buildPhasesAnchor)) {
    throw new Error('Could not locate the App target build phases.');
  }
  project = project.replace(
    buildPhasesAnchor,
    [
      '\t\t\tbuildPhases = (',
      `\t\t\t\t${verificationPhaseReference},`,
      '\t\t\t\t504EC3001FED79650016851F /* Sources */,',
    ].join('\n'),
  );

  const sourcesSectionAnchor = '/* Begin PBXSourcesBuildPhase section */';
  if (!project.includes(sourcesSectionAnchor)) {
    throw new Error('Could not locate the Xcode sources build phase section.');
  }
  const verificationPhase = [
    '/* Begin PBXShellScriptBuildPhase section */',
    `\t\t${verificationPhaseReference} = {`,
    '\t\t\tisa = PBXShellScriptBuildPhase;',
    '\t\t\talwaysOutOfDate = 1;',
    '\t\t\tbuildActionMask = 2147483647;',
    '\t\t\tfiles = (',
    '\t\t\t);',
    '\t\t\tinputPaths = (',
    '\t\t\t\t"$(SRCROOT)/../../scripts/verify-ios-web-assets.sh",',
    '\t\t\t\t"$(SRCROOT)/App/public",',
    '\t\t\t);',
    '\t\t\tname = "Verify Native Web Assets";',
    '\t\t\toutputPaths = (',
    '\t\t\t);',
    '\t\t\trunOnlyForDeploymentPostprocessing = 0;',
    '\t\t\tshellPath = /bin/sh;',
    '\t\t\tshellScript = "/bin/sh \\\"${SCRIPT_INPUT_FILE_0}\\\"\\n";',
    '\t\t\tshowEnvVarsInLog = 0;',
    '\t\t};',
    '/* End PBXShellScriptBuildPhase section */',
    '',
  ].join('\n');
  project = project.replace(sourcesSectionAnchor, `${verificationPhase}${sourcesSectionAnchor}`);
}

const buildNumbers = [...project.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map((match) => Number(match[1]));
const marketingVersions = [...project.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((match) => match[1]);
const entitlementReferences = (project.match(/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g) ?? []).length;
const verificationPhaseReferences = (project.match(/Verify Native Web Assets/g) ?? []).length;

if (buildNumbers.length !== 2 || buildNumbers.some((value) => value !== 160)) {
  throw new Error(`SafarMate 1.1 requires iOS build 160; found ${buildNumbers.join(', ')}.`);
}
if (marketingVersions.length !== 2 || marketingVersions.some((value) => value !== '1.1.0')) {
  throw new Error(`SafarMate 1.1 requires marketing version 1.1.0; found ${marketingVersions.join(', ')}.`);
}
if (entitlementReferences !== 2) {
  throw new Error(`Expected WeatherKit entitlements in both target configurations; found ${entitlementReferences}.`);
}
if (verificationPhaseReferences < 2) {
  throw new Error('The Xcode project must run the native web asset verification phase before compiling.');
}

if (!plist.includes('<key>CFBundleVersion</key>') || !plist.includes('<string>$(CURRENT_PROJECT_VERSION)</string>')) {
  throw new Error('Info.plist must inherit CFBundleVersion from CURRENT_PROJECT_VERSION.');
}

const alwaysLocationPurpose = plist.match(
  /<key>NSLocationAlwaysAndWhenInUseUsageDescription<\/key>\s*<string>([^<]+)<\/string>/,
)?.[1].trim();
const whenInUseLocationPurpose = plist.match(
  /<key>NSLocationWhenInUseUsageDescription<\/key>\s*<string>([^<]+)<\/string>/,
)?.[1].trim();
if (!alwaysLocationPurpose || alwaysLocationPurpose.length < 20) {
  throw new Error('Info.plist must contain a clear NSLocationAlwaysAndWhenInUseUsageDescription purpose string.');
}
if (!whenInUseLocationPurpose || whenInUseLocationPurpose.length < 20) {
  throw new Error('Info.plist must contain a clear NSLocationWhenInUseUsageDescription purpose string.');
}
if (alwaysLocationPurpose !== whenInUseLocationPurpose) {
  throw new Error('The two iOS location purpose strings must describe the same foreground-only SafarMate use.');
}

await Promise.all([
  writeFile(projectUrl, project),
  writeFile(plistUrl, plist),
]);
console.log('Configured SafarMate iOS 1.1.0 (160) with verified Apple Weather assets and location purpose strings.');
