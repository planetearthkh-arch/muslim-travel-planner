import { Capacitor, registerPlugin } from '@capacitor/core';

export const SAFARMATE_PREMIUM_PRODUCT_ID = 'com.planetearthkh.safarmate.premium.lifetime';
export const LEGACY_PREMIUM_MAX_BUILD = 154;

export type PremiumSource = 'purchase' | 'legacy' | 'none' | 'cached' | 'unavailable';
export type PurchaseOutcome = 'purchased' | 'pending' | 'cancelled' | 'failed';

export interface NativePremiumStatus {
  available: boolean;
  entitled: boolean;
  grandfathered: boolean;
  productId: string;
  displayPrice?: string;
  displayName?: string;
  productDescription?: string;
  originalAppVersion?: string;
  source?: PremiumSource;
}

export interface PremiumState extends NativePremiumStatus {
  loading: boolean;
  error: string;
}

interface NativePurchaseResult extends NativePremiumStatus {
  outcome: PurchaseOutcome;
}

interface SafarMateStorePlugin {
  getStatus(): Promise<NativePremiumStatus>;
  purchase(): Promise<NativePurchaseResult>;
  restore(): Promise<NativePurchaseResult>;
}

const nativeStore = registerPlugin<SafarMateStorePlugin>('SafarMateStore');
const CACHE_KEY = 'safarmate-premium-verified-v1';

const defaultState: PremiumState = {
  available: Capacitor.isNativePlatform(),
  entitled: false,
  grandfathered: false,
  productId: SAFARMATE_PREMIUM_PRODUCT_ID,
  displayPrice: '$3.99',
  source: Capacitor.isNativePlatform() ? 'none' : 'unavailable',
  loading: true,
  error: '',
};

function safeStorage(): Storage | undefined {
  try {
    const storage = window.localStorage;
    const testKey = '__safarmate_premium_test__';
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return storage;
  } catch {
    return undefined;
  }
}

export function parseOriginalBuild(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function qualifiesForLegacyPremium(value: string | undefined): boolean {
  const build = parseOriginalBuild(value);
  return build !== null && build <= LEGACY_PREMIUM_MAX_BUILD;
}

function normalizeStatus(status: NativePremiumStatus): PremiumState {
  const grandfathered = status.grandfathered || qualifiesForLegacyPremium(status.originalAppVersion);
  const entitled = status.entitled || grandfathered;
  return {
    ...defaultState,
    ...status,
    available: status.available,
    entitled,
    grandfathered,
    productId: SAFARMATE_PREMIUM_PRODUCT_ID,
    source: entitled ? (grandfathered ? 'legacy' : 'purchase') : (status.source ?? 'none'),
    loading: false,
    error: '',
  };
}

function readVerifiedCache(): PremiumState | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const parsed = JSON.parse(storage.getItem(CACHE_KEY) ?? 'null') as Partial<PremiumState> | null;
    if (!parsed?.entitled || parsed.productId !== SAFARMATE_PREMIUM_PRODUCT_ID) return null;
    return {
      ...defaultState,
      ...parsed,
      entitled: true,
      loading: false,
      error: '',
      source: 'cached',
    };
  } catch {
    return null;
  }
}

function cacheVerifiedEntitlement(state: PremiumState) {
  if (!state.entitled) return;
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(CACHE_KEY, JSON.stringify({
      available: state.available,
      entitled: true,
      grandfathered: state.grandfathered,
      productId: state.productId,
      displayPrice: state.displayPrice,
      originalAppVersion: state.originalAppVersion,
      source: state.source,
    }));
  } catch {
    // StoreKit remains the source of truth; caching is only an offline convenience.
  }
}

export class PremiumService {
  private state: PremiumState = { ...defaultState };
  private listeners = new Set<(state: PremiumState) => void>();
  private inFlight: Promise<PremiumState> | null = null;

  current(): PremiumState {
    return { ...this.state };
  }

  subscribe(listener: (state: PremiumState) => void): () => void {
    this.listeners.add(listener);
    listener(this.current());
    return () => this.listeners.delete(listener);
  }

  private publish(next: PremiumState): PremiumState {
    this.state = next;
    for (const listener of this.listeners) listener(this.current());
    return this.current();
  }

  async refresh(force = false): Promise<PremiumState> {
    if (this.inFlight && !force) return this.inFlight;
    this.inFlight = this.loadStatus().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  private async loadStatus(): Promise<PremiumState> {
    if (!Capacitor.isNativePlatform()) {
      return this.publish({ ...defaultState, available: false, loading: false, source: 'unavailable' });
    }
    this.publish({ ...this.state, loading: true, error: '' });
    try {
      const next = normalizeStatus(await nativeStore.getStatus());
      cacheVerifiedEntitlement(next);
      return this.publish(next);
    } catch (error) {
      const cached = readVerifiedCache();
      if (cached) return this.publish(cached);
      return this.publish({
        ...defaultState,
        available: false,
        loading: false,
        source: 'unavailable',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async purchase(): Promise<{ state: PremiumState; outcome: PurchaseOutcome }> {
    if (!Capacitor.isNativePlatform()) return { state: this.current(), outcome: 'failed' };
    this.publish({ ...this.state, loading: true, error: '' });
    try {
      const result = await nativeStore.purchase();
      const next = normalizeStatus(result);
      cacheVerifiedEntitlement(next);
      return { state: this.publish(next), outcome: result.outcome };
    } catch (error) {
      const next = this.publish({
        ...this.state,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
      return { state: next, outcome: 'failed' };
    }
  }

  async restore(): Promise<{ state: PremiumState; outcome: PurchaseOutcome }> {
    if (!Capacitor.isNativePlatform()) return { state: this.current(), outcome: 'failed' };
    this.publish({ ...this.state, loading: true, error: '' });
    try {
      const result = await nativeStore.restore();
      const next = normalizeStatus(result);
      cacheVerifiedEntitlement(next);
      return { state: this.publish(next), outcome: result.outcome };
    } catch (error) {
      const next = this.publish({
        ...this.state,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
      return { state: next, outcome: 'failed' };
    }
  }
}

export const premiumService = new PremiumService();
