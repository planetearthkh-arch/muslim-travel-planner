import maplibregl from 'maplibre-gl';

export const LATIN_MAP_NAME_EXPRESSION = [
  'coalesce',
  ['get', 'name:en'],
  ['get', 'name_en'],
  ['get', 'name:latin'],
  ['get', 'int_name'],
  ['get', 'official_name:en'],
  ['get', 'short_name:en'],
  ['get', 'ref'],
] as const;

export function containsRawMapName(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  if (value[0] === 'get' && value[1] === 'name') return true;
  return value.some(containsRawMapName);
}

const globalState = globalThis as typeof globalThis & { __safarOneLatinMapLabelsInstalled?: boolean };

if (!globalState.__safarOneLatinMapLabelsInstalled) {
  globalState.__safarOneLatinMapLabelsInstalled = true;
  const originalSetLayoutProperty = maplibregl.Map.prototype.setLayoutProperty;

  maplibregl.Map.prototype.setLayoutProperty = function (
    this: maplibregl.Map,
    ...args: Parameters<typeof originalSetLayoutProperty>
  ): ReturnType<typeof originalSetLayoutProperty> {
    const [layerId, property, value, ...rest] = args;
    const safeValue = property === 'text-field' && containsRawMapName(value)
      ? LATIN_MAP_NAME_EXPRESSION
      : value;
    return originalSetLayoutProperty.call(this, layerId, property, safeValue, ...rest);
  } as typeof originalSetLayoutProperty;
}
