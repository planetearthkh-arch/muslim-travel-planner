export type RequestFailureKind = 'timeout' | 'offline' | 'rate-limited' | 'temporary' | 'malformed' | 'aborted' | 'http' | 'unknown';

export class RequestError extends Error {
  kind: RequestFailureKind;
  status?: number;
  retryAfterMs?: number;

  constructor(kind: RequestFailureKind, message: string, status?: number, retryAfterMs?: number) {
    super(message);
    this.name = 'RequestError';
    this.kind = kind;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export function classifyHttpStatus(status: number): RequestFailureKind {
  if (status === 429) return 'rate-limited';
  if ([500, 502, 503, 504].includes(status)) return 'temporary';
  return 'http';
}

export function retryAfterMs(value: string | null) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0 && seconds <= 30) return seconds * 1000;
  const date = Date.parse(value);
  if (!Number.isNaN(date)) {
    const delay = date - Date.now();
    if (delay >= 0 && delay <= 30_000) return delay;
  }
  return undefined;
}

export function classifyRequestError(error: unknown): RequestError {
  if (error instanceof RequestError) return error;
  if (error instanceof DOMException && error.name === 'AbortError') return new RequestError('aborted', 'Request was cancelled');
  if (error instanceof SyntaxError) return new RequestError('malformed', 'Received invalid service data');
  if (error instanceof TypeError) return new RequestError('offline', 'Network request failed');
  if (error instanceof Error && /timed out/i.test(error.message)) return new RequestError('timeout', error.message);
  return new RequestError('unknown', error instanceof Error ? error.message : 'Request failed');
}

function timeoutSignal(milliseconds: number, externalSignal?: AbortSignal) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(new RequestError('timeout', 'Request timed out')), milliseconds);
  const abort = () => controller.abort(externalSignal?.reason);
  externalSignal?.addEventListener('abort', abort, { once: true });
  return {
    signal: controller.signal,
    cleanup: () => {
      globalThis.clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', abort);
    },
  };
}

export async function requestJson<T>(url: string, options: RequestInit = {}, milliseconds = 14_000): Promise<T> {
  const { signal, cleanup } = timeoutSignal(milliseconds, options.signal ?? undefined);
  try {
    const response = await fetch(url, { ...options, signal });
    if (!response.ok) {
      const kind = classifyHttpStatus(response.status);
      throw new RequestError(kind, kind === 'rate-limited' ? 'Too many requests' : `HTTP ${response.status}`, response.status, retryAfterMs(response.headers.get('Retry-After')));
    }
    try {
      return await response.json() as T;
    } catch (error) {
      const classified = classifyRequestError(error);
      throw classified.kind === 'aborted' ? classified : new RequestError('malformed', 'Received invalid service data');
    }
  } catch (error) {
    const classified = classifyRequestError(error);
    if (classified.kind === 'aborted' && signal.reason instanceof RequestError && signal.reason.kind === 'timeout') throw signal.reason;
    throw classified;
  } finally {
    cleanup();
  }
}

export async function retryOnceForTemporary<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    const classified = classifyRequestError(error);
    if (!['temporary', 'rate-limited'].includes(classified.kind)) throw classified;
    if (classified.retryAfterMs) await new Promise((resolve) => globalThis.setTimeout(resolve, classified.retryAfterMs));
    return operation();
  }
}
