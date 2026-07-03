const HALAL_FOOD_QUERY_MARKER = '["amenity"~"^(restaurant|fast_food|cafe|food_court)$"]';
const EXPENSIVE_TEXT_SELECTOR = /\["(?:description|description:en|note)"~"halal",i\]/;

export function optimizeHalalOverpassRequestBody(body: string) {
  if (!body.includes(HALAL_FOOD_QUERY_MARKER)) return body;
  const radius = Number(body.match(/\(around:(\d+),/)?.[1]);
  if (!Number.isFinite(radius) || radius <= 1000) return body;

  return body
    .split(';')
    .filter((segment) => !EXPENSIVE_TEXT_SELECTOR.test(segment))
    .join(';');
}

declare global {
  interface Window {
    __safarOneHalalWideRadiusFetchPatched?: boolean;
  }
}

if (typeof window !== 'undefined' && !window.__safarOneHalalWideRadiusFetchPatched) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    const body = typeof init?.body === 'string' ? init.body : undefined;
    if (body && /overpass/i.test(url)) {
      return originalFetch(input, { ...init, body: optimizeHalalOverpassRequestBody(body) });
    }
    return originalFetch(input, init);
  };
  window.__safarOneHalalWideRadiusFetchPatched = true;
}
