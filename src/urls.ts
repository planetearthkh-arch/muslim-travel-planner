export function safeExternalUrl(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return '';
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (url.protocol === 'https:') return url.toString();
    if (url.protocol === 'http:' && url.hostname === 'example.com') return url.toString();
    return '';
  } catch {
    return '';
  }
}
