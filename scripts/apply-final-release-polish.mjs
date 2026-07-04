import { readFile, writeFile } from 'node:fs/promises';

async function edit(path, transform) {
  const before = await readFile(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`No changes made to ${path}`);
  await writeFile(path, after);
}

function exact(source, search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(search, replacement);
}

function replaceCount(source, search, replacement, expected, label) {
  const count = source.split(search).length - 1;
  if (count !== expected) throw new Error(`${label}: expected ${expected} matches, found ${count}`);
  return source.split(search).join(replacement);
}

await edit('ios/App/App.xcodeproj/project.pbxproj', (source) =>
  replaceCount(source, 'CURRENT_PROJECT_VERSION = 101;', 'CURRENT_PROJECT_VERSION = 102;', 2, 'iOS build 102'));

await edit('scripts/verify-ios-version.mjs', (source) => {
  source = exact(source, 'version < 101', 'version < 102', 'version verifier minimum');
  return exact(source, 'must be at least 101', 'must be at least 102', 'version verifier message');
});

for (const path of ['src/deep-audit-fixes.test.ts', 'src/release-audit-fixes.test.ts']) {
  await edit(path, (source) => source
    .replaceAll('CURRENT_PROJECT_VERSION = 101;', 'CURRENT_PROJECT_VERSION = 102;')
    .replaceAll('version < 101', 'version < 102'));
}

await edit('src/safe-storage.ts', (source) => exact(
  source,
  `export function isPersistentStorageAvailable() {
  getSafeStorage();
  return persistentStorageAvailable;
}`,
  `export function isPersistentStorageAvailable() {
  return persistentStorageAvailable;
}`,
  'stable storage capability status',
));

await edit('src/android-athan.ts', (source) => {
  source = exact(
    source,
    `  requestPermissions(): Promise<{ exactAlarmAllowed: boolean; notificationsAllowed: boolean }>;
  schedule(options: { alarms: AndroidAthanAlarm[] }): Promise<{ scheduled: number }>;`,
    `  requestPermissions(): Promise<{ exactAlarmAllowed: boolean; notificationsAllowed: boolean }>;
  checkPermissions(): Promise<{ exactAlarmAllowed: boolean; notificationsAllowed: boolean }>;
  schedule(options: { alarms: AndroidAthanAlarm[] }): Promise<{ scheduled: number }>;`,
    'Android permission checker type',
  );
  return exact(
    source,
    `  test(options: { language: string }): Promise<void>;`,
    `  test(options: { language: string; prayer: string; city: string }): Promise<void>;`,
    'localized Android test type',
  );
});

await edit('src/athan.ts', (source) => {
  source = exact(
    source,
    `export async function hasScheduledAthanAlarms() {`,
    `export async function checkAthanPermissions() {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    return AndroidAthan.checkPermissions();
  }
  return { exactAlarmAllowed: true, notificationsAllowed: true };
}

export async function hasScheduledAthanAlarms() {`,
    'Athan permission recheck helper',
  );
  return exact(
    source,
    `    await AndroidAthan.prepare({ audioUrl: ATHAN_AUDIO_URL });
    await AndroidAthan.test({ language });`,
    `    await AndroidAthan.prepare({ audioUrl: ATHAN_AUDIO_URL });
    const copy = copyFor(language);
    await AndroidAthan.test({ language, prayer: copy.testTitle, city: copy.testBody });`,
    'localized Android test payload',
  );
});

await edit('mobile/android/java/AthanAlarmPlugin.java', (source) => {
  source = exact(source, 'import java.net.URL;\nimport java.util.concurrent.ExecutorService;', 'import java.net.URL;\nimport java.util.Locale;\nimport java.util.concurrent.ExecutorService;', 'Java Locale import');
  source = exact(
    source,
    `    @PluginMethod
    public void schedule(PluginCall call) {`,
    `    @PluginMethod
    public void checkPermissions(PluginCall call) {
        Context context = getContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        boolean exactAllowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms();
        boolean notificationsAllowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        call.resolve(new JSObject()
            .put("exactAlarmAllowed", exactAllowed)
            .put("notificationsAllowed", notificationsAllowed));
    }

    @PluginMethod
    public void schedule(PluginCall call) {`,
    'Java permission recheck method',
  );
  source = exact(
    source,
    `        Intent intent = new Intent(getContext(), AthanPlaybackService.class);
        intent.putExtra("prayer", "Test Athan");
        intent.putExtra("city", "SafarOne");
        intent.putExtra("language", call.getString("language", "en"));`,
    `        Intent intent = new Intent(getContext(), AthanPlaybackService.class);
        intent.putExtra("prayer", call.getString("prayer", "SafarOne prayer notification"));
        intent.putExtra("city", call.getString("city", "Prayer notification sound"));
        intent.putExtra("language", call.getString("language", "en"));`,
    'localized Java test notification',
  );
  source = exact(
    source,
    `    private static void download(String address, File destination) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
        connection.setConnectTimeout(15_000);
        connection.setReadTimeout(30_000);
        connection.setInstanceFollowRedirects(true);
        connection.connect();
        int responseCode = connection.getResponseCode();`,
    `    private static URL validateAudioUrl(String address) throws Exception {
        URL url = new URL(address);
        String host = url.getHost() == null ? "" : url.getHost().toLowerCase(Locale.ROOT);
        boolean trustedHost = host.equals("assabile.com") || host.endsWith(".assabile.com");
        if (!"https".equalsIgnoreCase(url.getProtocol()) || !trustedHost) {
            throw new IllegalStateException("Athan audio URL is not trusted.");
        }
        return url;
    }

    private static void download(String address, File destination) throws Exception {
        URL sourceUrl = validateAudioUrl(address);
        HttpURLConnection connection = (HttpURLConnection) sourceUrl.openConnection();
        connection.setConnectTimeout(15_000);
        connection.setReadTimeout(30_000);
        connection.setInstanceFollowRedirects(true);
        connection.connect();
        validateAudioUrl(connection.getURL().toString());
        int responseCode = connection.getResponseCode();`,
    'trusted Athan URL validation',
  );
  return source;
});

await edit('src/main.ts', (source) => {
  source = exact(source, `import { cities } from './data.js';`, `import { App } from '@capacitor/app';\nimport { cities } from './data.js';`, 'Capacitor App import');
  source = exact(
    source,
    `  calculatePrayerAlarms,
  calculatePrayerDisplay,
  disableAthanAlarms,`,
    `  calculatePrayerAlarms,
  calculatePrayerDisplay,
  checkAthanPermissions,
  disableAthanAlarms,`,
    'Athan permission helper import',
  );
  source = exact(
    source,
    `let athanEnabled = appStorage.getItem('athanEnabled') === 'true';
let athanStateRefreshStarted = false;`,
    `let athanEnabled = appStorage.getItem('athanEnabled') === 'true';
let athanPermissionRetryPending = false;
let athanPermissionRetryRunning = false;
let athanStateRefreshStarted = false;`,
    'Athan retry state',
  );
  source = exact(
    source,
    `let flightManualProgress = preparedFlightPlan ? elapsedProgress(preparedFlightPlan) : 0;
let flightGpsEnabled = false;`,
    `let flightManualProgress = preparedFlightPlan ? elapsedProgress(preparedFlightPlan) : 0;
let flightProgressMode: 'elapsed' | 'manual' = 'elapsed';
let flightGpsEnabled = false;`,
    'flight progress mode state',
  );
  source = exact(
    source,
    `  if (view !== 'flight-mode' || !preparedFlightPlan || flightEditing || flightGpsEnabled || document.hidden) return;`,
    `  if (view !== 'flight-mode' || !preparedFlightPlan || flightEditing || flightGpsEnabled || flightProgressMode !== 'elapsed' || document.hidden) return;`,
    'flight timer mode guard',
  );
  source = exact(
    source,
    `    if (view !== 'flight-mode' || !preparedFlightPlan || flightEditing || flightGpsEnabled) return;`,
    `    if (view !== 'flight-mode' || !preparedFlightPlan || flightEditing || flightGpsEnabled || flightProgressMode !== 'elapsed') return;`,
    'flight timer callback mode guard',
  );
  source = replaceCount(
    source,
    `    flightManualProgress = elapsedProgress(preparedFlightPlan);
    flightStatus = labels[lang].flightPlanSaved;`,
    `    flightProgressMode = 'elapsed';
    flightManualProgress = elapsedProgress(preparedFlightPlan);
    flightStatus = labels[lang].flightPlanSaved;`,
    2,
    'new flight plans use elapsed mode',
  );
  source = exact(
    source,
    `  document.querySelector<HTMLInputElement>('#flight-progress')?.addEventListener('change', (event) => {
    flightManualProgress = Number((event.target as HTMLInputElement).value) / 100;
    flightModePage();
  });`,
    `  document.querySelector<HTMLInputElement>('#flight-progress')?.addEventListener('change', (event) => {
    flightProgressMode = 'manual';
    flightManualProgress = Number((event.target as HTMLInputElement).value) / 100;
    flightModePage();
  });`,
    'manual flight slider mode',
  );
  source = exact(
    source,
    `  document.querySelector<HTMLButtonElement>('#flight-elapsed')?.addEventListener('click', () => {
    if (preparedFlightPlan) flightManualProgress = elapsedProgress(preparedFlightPlan);
    flightModePage();
  });`,
    `  document.querySelector<HTMLButtonElement>('#flight-elapsed')?.addEventListener('click', () => {
    flightProgressMode = 'elapsed';
    if (preparedFlightPlan) flightManualProgress = elapsedProgress(preparedFlightPlan);
    flightModePage();
  });`,
    'elapsed flight mode button',
  );
  source = exact(
    source,
    `    preparedFlightPlan = null;
    flightEditing = true;
    flightStatus = labels[lang].flightPlanCleared;`,
    `    preparedFlightPlan = null;
    flightEditing = true;
    flightProgressMode = 'elapsed';
    flightStatus = labels[lang].flightPlanCleared;`,
    'clear flight mode reset',
  );
  source = exact(
    source,
    `function reportCenterDetails(center: PrayerCenter | undefined) {
  const parts = (center?.label ?? '').split(',').map((part) => part.trim()).filter(Boolean);
  return {
    city: center?.city || parts.at(-2) || selectedCity().city,
    country: center?.country || parts.at(-1) || selectedCity().country,
  };
}`,
    `function reportCenterDetails(center: PrayerCenter | undefined) {
  const parts = (center?.label ?? '').split(',').map((part) => part.trim()).filter(Boolean);
  const inferredCity = parts.length > 1 ? parts.at(-2) : center?.label?.trim();
  const inferredCountry = parts.length > 1 ? parts.at(-1) : '';
  return {
    city: center?.city || inferredCity || '',
    country: center?.country || inferredCountry || '',
  };
}`,
    'honest report location fallback',
  );
  source = exact(
    source,
    `${'${esc(item.city)}, ${esc(item.country)}'}`,
    `${'${esc([item.city, item.country].filter(Boolean).join(", "))}'}`,
    'saved attraction location display',
  );
  source = exact(
    source,
    `  const validDate = (value: string) => /^\\d{4}-\\d{2}-\\d{2}$/.test(value) && Number.isFinite(new Date(\`${'${value}'}T00:00:00\`).getTime());`,
    `  const validDate = (value: string) => {
    const match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(value);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(\`${'${value}'}T00:00:00\`);
    return Number.isFinite(date.getTime()) && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  };`,
    'strict calendar date validation',
  );

  const enableBlock = `  document.querySelector<HTMLButtonElement>('#enable-athan')?.addEventListener('click', async () => {
    const copy = athanLabels[lang];
    athanStatus = copy.preparing;
    render();
    try {
      const alarmPrefs = generatedPrefs ?? prefs;
      const city = cityForPreferences(alarmPrefs) ?? selectedCity();
      const alertDays = Math.max(1, itineraryDayKeys(alarmPrefs.startDate, alarmPrefs.endDate).length);
      const alarms = calculatePrayerAlarms(city, alarmPrefs.prayerMethod, alarmPrefs.startDate, localeForLanguage(lang), alertDays);
      if (!alarms.length) {
        athanStatus = copy.noFuture;
        render();
        return;
      }
      const result = await enableAthanAlarms(alarms, lang);
      athanEnabled = result.scheduled > 0 && result.permissions.notificationsAllowed;
      appStorage.setItem('athanEnabled', String(athanEnabled));
      athanStatus = athanEnabled
        ? \`${'${copy.scheduled}'}: ${'${result.scheduled}'}/${'${result.requested}'}\`
        : !result.permissions.exactAlarmAllowed && result.permissions.notificationsAllowed ? copy.permissionNote : copy.failed;
    } catch (error) {
      console.error(error);
      athanStatus = copy.failed;
    }
    render();
  });`;
  const helperAndBinding = `  document.querySelector<HTMLButtonElement>('#enable-athan')?.addEventListener('click', () => void enableCurrentAthanAlerts());`;
  source = exact(source, enableBlock, helperAndBinding, 'Athan enable binding');
  source = exact(
    source,
    `function bind() {`,
    `async function enableCurrentAthanAlerts() {
  const copy = athanLabels[lang];
  athanStatus = copy.preparing;
  render();
  try {
    const alarmPrefs = generatedPrefs ?? prefs;
    const city = cityForPreferences(alarmPrefs) ?? selectedCity();
    const alertDays = Math.max(1, itineraryDayKeys(alarmPrefs.startDate, alarmPrefs.endDate).length);
    const alarms = calculatePrayerAlarms(city, alarmPrefs.prayerMethod, alarmPrefs.startDate, localeForLanguage(lang), alertDays);
    if (!alarms.length) {
      athanPermissionRetryPending = false;
      athanStatus = copy.noFuture;
      render();
      return;
    }
    const result = await enableAthanAlarms(alarms, lang);
    athanEnabled = result.scheduled > 0 && result.permissions.notificationsAllowed;
    athanPermissionRetryPending = !result.permissions.exactAlarmAllowed && result.permissions.notificationsAllowed;
    appStorage.setItem('athanEnabled', String(athanEnabled));
    athanStatus = athanEnabled
      ? \`${'${copy.scheduled}'}: ${'${result.scheduled}'}/${'${result.requested}'}\`
      : athanPermissionRetryPending ? copy.permissionNote : copy.failed;
  } catch (error) {
    console.error(error);
    athanPermissionRetryPending = false;
    athanStatus = copy.failed;
  }
  render();
}

async function retryAthanAfterPermissionReturn() {
  if (!athanPermissionRetryPending || athanPermissionRetryRunning) return;
  athanPermissionRetryRunning = true;
  try {
    const permissions = await checkAthanPermissions();
    if (!permissions.exactAlarmAllowed || !permissions.notificationsAllowed) return;
    athanPermissionRetryPending = false;
    await enableCurrentAthanAlerts();
  } catch (error) {
    console.error(error);
  } finally {
    athanPermissionRetryRunning = false;
  }
}

function bind() {`,
    'Athan enable and resume helpers',
  );
  source = exact(
    source,
    `  document.querySelector<HTMLButtonElement>('#disable-athan')?.addEventListener('click', async () => {
    await disableAthanAlarms();`,
    `  document.querySelector<HTMLButtonElement>('#disable-athan')?.addEventListener('click', async () => {
    athanPermissionRetryPending = false;
    await disableAthanAlarms();`,
    'disable clears Athan retry',
  );
  source = exact(
    source,
    `render();
void refreshAthanEnabledState();
void registerAppServiceWorker();`,
    `void App.addListener('appStateChange', ({ isActive }) => {
  if (isActive) void retryAthanAfterPermissionReturn();
}).catch((error) => console.warn('Could not register app-state listener', error));

render();
void refreshAthanEnabledState();
void registerAppServiceWorker();`,
    'native app resume listener',
  );
  return source;
});

await edit('src/release-audit-fixes.test.ts', (source) => {
  source = exact(source, `assert.equal((project.match(/CURRENT_PROJECT_VERSION = 102;/g) ?? []).length, 2);`, `assert.equal((project.match(/CURRENT_PROJECT_VERSION = 102;/g) ?? []).length, 2);`, 'build 102 test already updated');
  source = exact(source, `  assert.equal(main.includes('scheduleFlightClock()'), true);`, `  assert.equal(main.includes('scheduleFlightClock()'), true);\n  assert.equal(main.includes("flightProgressMode: 'elapsed' | 'manual'"), true);\n  assert.equal(main.includes("App.addListener('appStateChange'"), true);`, 'flight and app resume regression assertions');
  source = exact(source, `  assert.equal(plugin.includes('MAX_AUDIO_BYTES'), true);`, `  assert.equal(plugin.includes('MAX_AUDIO_BYTES'), true);\n  assert.equal(plugin.includes('checkPermissions(PluginCall call)'), true);\n  assert.equal(plugin.includes('validateAudioUrl'), true);`, 'Android permission and URL assertions');
  return source;
});

console.log('Applied final release polish.');
