from __future__ import annotations

import re
from audit_fix_common import read, write, replace_once

# ---------------------------------------------------------------------------
# Main application fixes
# ---------------------------------------------------------------------------
main_path = 'src/main.ts'
main = read(main_path)

main = replace_once(
    main,
    "let lang: Language = parseLanguage(appStorage.getItem('mtp-language')) ?? 'en';\n",
    "let lang: Language = parseLanguage(appStorage.getItem('mtp-language')) ?? 'en';\n"
    "function setAppLanguage(value: unknown) {\n"
    "  const parsed = parseLanguage(value);\n"
    "  if (!parsed) return false;\n"
    "  lang = parsed;\n"
    "  appStorage.setItem('mtp-language', lang);\n"
    "  return true;\n"
    "}\n",
    'insert persistent language helper',
)

# Every tool page now validates and persists language selection.
main, language_assignment_count = re.subn(
    r"lang = \(event\.target as HTMLSelectElement\)\.value as Language;",
    "if (!setAppLanguage((event.target as HTMLSelectElement).value)) return;",
    main,
)
if language_assignment_count < 8:
    raise RuntimeError(f'language handler patch: expected many handlers, found {language_assignment_count}')

# Avoid direct localStorage access in environments where it is unavailable.
main = main.replace('localStorage', 'appStorage')

# Restore the language stored with a reopened saved trip.
main = replace_once(
    main,
    "function openSavedTrip(trip: SavedTrip) {\n  prefs = { ...trip.preferences, interests: [...trip.preferences.interests] };",
    "function openSavedTrip(trip: SavedTrip) {\n"
    "  setAppLanguage(trip.language);\n"
    "  prefs = { ...trip.preferences, interests: [...trip.preferences.interests] };",
    'restore saved-trip language',
)

# Use the selected trip range instead of always scheduling seven days.
main = replace_once(
    main,
    "const alarms = calculatePrayerAlarms(city, alarmPrefs.prayerMethod, alarmPrefs.startDate, localeForLanguage(lang), 7);",
    "const alertDays = Math.max(1, itineraryDayKeys(alarmPrefs.startDate, alarmPrefs.endDate).length);\n"
    "      const alarms = calculatePrayerAlarms(city, alarmPrefs.prayerMethod, alarmPrefs.startDate, localeForLanguage(lang), alertDays);",
    'schedule alerts for selected trip range',
)

# Flight Mode must use its own selected calculation method.
main = replace_once(
    main,
    "${choiceSelect('prayerMethod', copy.flightMethod, prayerMethods, Object.fromEntries(prayerMethods.map((method) => [method, method])) as Record<(typeof prayerMethods)[number], string>)}",
    "<label>${copy.flightMethod}<select id=\"flight-prayer-method\">${prayerMethods.map((method) => `<option value=\"${esc(method)}\" ${(plan?.prayerMethod ?? prefs.prayerMethod) === method ? 'selected' : ''}>${esc(method)}</option>`).join('')}</select></label>",
    'Flight Mode calculation-method control',
)
main = replace_once(
    main,
    "prayerMethod: prefs.prayerMethod,\n    cruiseAltitudeMeters: altitudeMeters,",
    "prayerMethod: (document.querySelector<HTMLSelectElement>('#flight-prayer-method')?.value as PlannerPreferences['prayerMethod']) || prefs.prayerMethod,\n"
    "    cruiseAltitudeMeters: altitudeMeters,",
    'read Flight Mode calculation method',
)

# Prayer calculations must use the timestamp represented by the active flight position.
main = replace_once(
    main,
    "const prayer = activePosition ? calculateInflightPrayerSnapshot(activePosition.latitude, activePosition.longitude, now, plan.prayerMethod) : null;",
    "const prayer = activePosition ? calculateInflightPrayerSnapshot(activePosition.latitude, activePosition.longitude, activePosition.timestamp, plan.prayerMethod) : null;",
    'Flight Mode prayer timestamp',
)
main = main.replace("`${qiblaBearing.toFixed(1)}° true`", "`${qiblaBearing.toFixed(1)}°`")
main = main.replace("`${progress.trackDegrees.toFixed(1)}° true`", "`${progress.trackDegrees.toFixed(1)}°`")

# Do not replace the range control while a user is dragging it.
main = replace_once(
    main,
    "document.querySelector<HTMLInputElement>('#flight-progress')?.addEventListener('input', (event) => {",
    "document.querySelector<HTMLInputElement>('#flight-progress')?.addEventListener('change', (event) => {",
    'Flight Mode slider stability',
)
main = replace_once(
    main,
    "if (preparedFlightPlan) flightManualProgress = chooseFlightProgress(preparedFlightPlan, { gps: flightLatestGps, previousGps: flightPreviousGps, manualProgress: flightManualProgress }).progress;\n      flightModePage();",
    "if (preparedFlightPlan) flightManualProgress = chooseFlightProgress(preparedFlightPlan, { gps: flightLatestGps, previousGps: flightPreviousGps, manualProgress: flightManualProgress }).progress;\n"
    "      if (document.activeElement?.id !== 'flight-progress') flightModePage();",
    'avoid GPS rerender during slider interaction',
)

# Derive report city/country from the actual search centre rather than planner defaults.
main = replace_once(
    main,
    "function prayerTypeLabel(type: PrayerPlaceType, copy: typeof labels[Language]) {",
    "function reportCenterDetails(center: PrayerCenter | undefined) {\n"
    "  const parts = (center?.label ?? '').split(',').map((part) => part.trim()).filter(Boolean);\n"
    "  return {\n"
    "    city: parts[0] || selectedCity().city,\n"
    "    country: parts.slice(1).join(', ') || selectedCity().country,\n"
    "  };\n"
    "}\n\n"
    "function prayerTypeLabel(type: PrayerPlaceType, copy: typeof labels[Language]) {",
    'report-centre metadata helper',
)
main = replace_once(
    main,
    "const reportPlace: ReportablePlace = { feature: copy.prayerSpacesTitle, name: displayName, sourceUrl: place.sourceUrl, latitude: place.latitude, longitude: place.longitude, city: selectedCity().city, country: selectedCity().country };",
    "const reportPlace: ReportablePlace = { feature: copy.prayerSpacesTitle, name: displayName, sourceUrl: place.sourceUrl, latitude: place.latitude, longitude: place.longitude, ...reportCenterDetails(prayerCenter) };",
    'prayer report location',
)
main = replace_once(
    main,
    "const reportPlace: ReportablePlace = { feature: copy.attractionsTitle, name: attraction.name, sourceUrl: attraction.sourceUrl, latitude: attraction.latitude, longitude: attraction.longitude, city: selectedCity().city, country: selectedCity().country };",
    "const reportPlace: ReportablePlace = { feature: copy.attractionsTitle, name: attraction.name, sourceUrl: attraction.sourceUrl, latitude: attraction.latitude, longitude: attraction.longitude, ...reportCenterDetails(attractionCenter) };",
    'attraction report location',
)

# Resolve an IANA timezone for manually searched destinations using Open-Meteo.
main = replace_once(
    main,
    "async function resolveRestaurantDestination(query: string): Promise<PrayerCenter | undefined> {",
    "async function resolveTimeZoneForCoordinates(latitude: number, longitude: number) {\n"
    "  try {\n"
    "    const url = `${OPEN_METEO_FORECAST_URL}?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&timezone=auto&forecast_days=1&current=temperature_2m`;\n"
    "    const result = await requestJson<{ timezone?: string }>(url, { headers: { Accept: 'application/json' } }, 7000);\n"
    "    const candidate = result.timezone?.trim();\n"
    "    if (!candidate) return undefined;\n"
    "    new Intl.DateTimeFormat('en', { timeZone: candidate }).format(new Date());\n"
    "    return candidate;\n"
    "  } catch {\n"
    "    return undefined;\n"
    "  }\n"
    "}\n\n"
    "async function resolveRestaurantDestination(query: string): Promise<PrayerCenter | undefined> {",
    'manual destination timezone helper',
)
main = replace_once(
    main,
    "const center = first ? { latitude: Number(first.lat), longitude: Number(first.lon), label: first.display_name } : undefined;\n  destinationCache.set(trimmed.toLowerCase(), { expires: Date.now() + 15 * 60 * 1000, center });",
    "const latitude = first ? Number(first.lat) : Number.NaN;\n"
    "  const longitude = first ? Number(first.lon) : Number.NaN;\n"
    "  const center = first && Number.isFinite(latitude) && Number.isFinite(longitude)\n"
    "    ? { latitude, longitude, label: first.display_name, timezone: await resolveTimeZoneForCoordinates(latitude, longitude) }\n"
    "    : undefined;\n"
    "  destinationCache.set(trimmed.toLowerCase(), { expires: Date.now() + 15 * 60 * 1000, center });",
    'attach timezone to geocoded destination',
)

# Reuse timezone-aware destination resolution for prayer-place manual searches.
old_prayer_geocode = """    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const data = await requestJson<NominatimResult[]>(url, { headers: { Accept: 'application/json' } }, 12000);
    if (!isCurrentPrayerSearch()) return;
    const first = data[0];
    if (!first) {
      if (!isCurrentPrayerSearch()) return;
      prayerStatus = 'empty';
      prayerResults = [];
      prayerPage();
      return;
    }
    await searchPrayerPlaces({ latitude: Number(first.lat), longitude: Number(first.lon), label: first.display_name }, sequence);"""
new_prayer_geocode = """    const center = await resolveRestaurantDestination(query);
    if (!isCurrentPrayerSearch()) return;
    if (!center) {
      prayerStatus = 'empty';
      prayerResults = [];
      prayerPage();
      return;
    }
    await searchPrayerPlaces(center, sequence);"""
main = replace_once(main, old_prayer_geocode, new_prayer_geocode, 'timezone-aware prayer search')

# Persist attraction saves rather than only changing button text.
main = replace_once(
    main,
    "let selectedAttractionId = '';\nlet attractionDiagnostics: string[] = [];",
    "let selectedAttractionId = '';\n"
    "const SAVED_ATTRACTIONS_KEY = 'mtp-saved-attractions-v1';\n"
    "function readSavedAttractionIds() {\n"
    "  try {\n"
    "    const value = JSON.parse(appStorage.getItem(SAVED_ATTRACTIONS_KEY) ?? '[]') as unknown;\n"
    "    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);\n"
    "  } catch {\n"
    "    return new Set<string>();\n"
    "  }\n"
    "}\n"
    "let savedAttractionIds = readSavedAttractionIds();\n"
    "function persistSavedAttractionIds() {\n"
    "  appStorage.setItem(SAVED_ATTRACTIONS_KEY, JSON.stringify([...savedAttractionIds]));\n"
    "}\n"
    "let attractionDiagnostics: string[] = [];",
    'saved-attraction storage',
)
main = replace_once(
    main,
    "<button type=\"button\" class=\"ghost\" data-attraction-save=\"${attraction.id}\">${copy.attractionsSave}</button>",
    "<button type=\"button\" class=\"ghost\" data-attraction-save=\"${attraction.id}\" aria-pressed=\"${savedAttractionIds.has(attraction.id)}\">${savedAttractionIds.has(attraction.id) ? copy.attractionsSaved : copy.attractionsSave}</button>",
    'saved-attraction button state',
)
main = replace_once(
    main,
    "document.querySelectorAll<HTMLButtonElement>('[data-attraction-save]').forEach((button) => button.addEventListener('click', () => { button.textContent = labels[lang].attractionsSaved; }));",
    "document.querySelectorAll<HTMLButtonElement>('[data-attraction-save]').forEach((button) => button.addEventListener('click', () => {\n"
    "    const id = button.dataset.attractionSave;\n"
    "    if (!id) return;\n"
    "    if (savedAttractionIds.has(id)) savedAttractionIds.delete(id);\n"
    "    else savedAttractionIds.add(id);\n"
    "    persistSavedAttractionIds();\n"
    "    button.setAttribute('aria-pressed', String(savedAttractionIds.has(id)));\n"
    "    button.textContent = savedAttractionIds.has(id) ? labels[lang].attractionsSaved : labels[lang].attractionsSave;\n"
    "  }));",
    'saved-attraction action',
)

# Correct Attractions copy/paste label.
main = main.replace("${copy.toiletsSearchThisArea}</button><button type=\"button\" id=\"attractions-recentre\"", "${copy.attractionsSearch}</button><button type=\"button\" id=\"attractions-recentre\"")
main = main.replace("label: labels[lang].toiletsSearchThisArea, timezone: attractionCenter?.timezone", "label: labels[lang].attractionsSearch, timezone: attractionCenter?.timezone")

# Clean up every MapLibre instance when returning to planner.
main = replace_once(
    main,
    "if (view === 'planner') { stopQiblaOrientation(); prayerMap?.remove(); prayerMap = undefined; restaurantMap?.remove(); restaurantMap = undefined; publicTransportMap?.remove(); publicTransportMap = undefined; taxiMap?.remove(); taxiMap = undefined; }",
    "if (view === 'planner') {\n"
    "    stopQiblaOrientation();\n"
    "    [cityMap, prayerMap, restaurantMap, toiletMap, carRentalMap, publicTransportMap, taxiMap, attractionsMap].forEach((map) => map?.remove());\n"
    "    cityMap = prayerMap = restaurantMap = toiletMap = carRentalMap = publicTransportMap = taxiMap = attractionsMap = undefined;\n"
    "  }",
    'complete map cleanup',
)

# Add modal background inertness and focus trapping.
main = replace_once(
    main,
    "document.body.append(backdrop);\n  const reasonInput",
    "document.body.append(backdrop);\n"
    "  root?.setAttribute('inert', '');\n"
    "  const reasonInput",
    'make report background inert',
)
main = replace_once(
    main,
    "const close = () => {\n    backdrop.remove();\n    trigger?.focus();\n  };",
    "const close = () => {\n"
    "    root?.removeAttribute('inert');\n"
    "    backdrop.remove();\n"
    "    trigger?.focus();\n"
    "  };",
    'restore report background',
)
main = replace_once(
    main,
    "backdrop.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });",
    "backdrop.addEventListener('keydown', (event) => {\n"
    "    if (event.key === 'Escape') { close(); return; }\n"
    "    if (event.key !== 'Tab') return;\n"
    "    const focusable = [...backdrop.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select, textarea, input:not([disabled]), [tabindex]:not([tabindex=\"-1\"])')].filter((element) => !element.hidden);\n"
    "    if (!focusable.length) return;\n"
    "    const first = focusable[0];\n"
    "    const last = focusable[focusable.length - 1];\n"
    "    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }\n"
    "    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }\n"
    "  });",
    'trap focus in report dialog',
)

# Import and refresh real notification state.
main = replace_once(
    main,
    "  isNativeAthanAvailable,\n  playTestAthan,",
    "  hasScheduledAthanAlarms,\n  isNativeAthanAvailable,\n  playTestAthan,",
    'import notification state checker',
)
main = replace_once(
    main,
    "let athanEnabled = appStorage.getItem('athanEnabled') === 'true';\nlet athanStatus = '';",
    "let athanEnabled = appStorage.getItem('athanEnabled') === 'true';\n"
    "let athanStateRefreshStarted = false;\n"
    "async function refreshAthanEnabledState() {\n"
    "  if (athanStateRefreshStarted) return;\n"
    "  athanStateRefreshStarted = true;\n"
    "  try {\n"
    "    const next = await hasScheduledAthanAlarms();\n"
    "    if (next !== athanEnabled) {\n"
    "      athanEnabled = next;\n"
    "      appStorage.setItem('athanEnabled', String(next));\n"
    "      render();\n"
    "    }\n"
    "  } finally {\n"
    "    athanStateRefreshStarted = false;\n"
    "  }\n"
    "}\n"
    "let athanStatus = '';",
    'notification state refresh',
)
main = replace_once(
    main,
    "render();\nvoid registerAppServiceWorker();",
    "render();\nvoid refreshAthanEnabledState();\nvoid registerAppServiceWorker();",
    'refresh notification state at startup',
)

write(main_path, main)
