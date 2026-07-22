import { Capacitor, registerPlugin } from '@capacitor/core';

export const SAFARMATE_PREMIUM_PRODUCT_ID = 'com.planetearthkh.safarmate.premium.lifetime';
export const LEGACY_PREMIUM_MAX_BUILD = 154;

export type PremiumSource = 'purchase' | 'legacy' | 'none' | 'unavailable';
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

export function supportsPremiumPlatform(platform: string): boolean {
  return platform === 'ios' || platform === 'android';
}

export function isPremiumPlatform(): boolean {
  return supportsPremiumPlatform(Capacitor.getPlatform());
}

const defaultState: PremiumState = {
  available: isPremiumPlatform(),
  entitled: false,
  grandfathered: false,
  productId: SAFARMATE_PREMIUM_PRODUCT_ID,
  displayPrice: '$3.99',
  source: isPremiumPlatform() ? 'none' : 'unavailable',
  loading: true,
  error: '',
};

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
    if (!isPremiumPlatform()) {
      return this.publish({ ...defaultState, available: false, loading: false, source: 'unavailable' });
    }
    this.publish({ ...this.state, loading: true, error: '' });
    try {
      return this.publish(normalizeStatus(await nativeStore.getStatus()));
    } catch (error) {
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
    if (!isPremiumPlatform()) return { state: this.current(), outcome: 'failed' };
    this.publish({ ...this.state, loading: true, error: '' });
    try {
      const result = await nativeStore.purchase();
      return { state: this.publish(normalizeStatus(result)), outcome: result.outcome };
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
    if (!isPremiumPlatform()) return { state: this.current(), outcome: 'failed' };
    this.publish({ ...this.state, loading: true, error: '' });
    try {
      const result = await nativeStore.restore();
      return { state: this.publish(normalizeStatus(result)), outcome: result.outcome };
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
