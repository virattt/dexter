import type { FinanceDataProviderId, FinanceProviderResult } from './types.js';
import { getFinanceProviderMode } from './config.js';

export interface ProviderAttempt<T> {
  provider: FinanceDataProviderId;
  run: () => Promise<Omit<FinanceProviderResult<T>, 'provider'>>;
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function uniqueProviders(attempts: ProviderAttempt<unknown>[]): FinanceDataProviderId[] {
  const seen = new Set<FinanceDataProviderId>();
  const order: FinanceDataProviderId[] = [];
  for (const a of attempts) {
    if (!seen.has(a.provider)) {
      seen.add(a.provider);
      order.push(a.provider);
    }
  }
  return order;
}

export async function runFinanceProviderChain<T>(
  label: string,
  attempts: ProviderAttempt<T>[]
): Promise<FinanceProviderResult<T>> {
  const mode = getFinanceProviderMode();
  const allowed =
    mode.mode === 'fixed'
      ? new Set<FinanceDataProviderId>([mode.provider])
      : new Set<FinanceDataProviderId>(uniqueProviders(attempts));

  const errors: { provider: FinanceDataProviderId; error: string }[] = [];

  for (const attempt of attempts) {
    if (!allowed.has(attempt.provider)) continue;
    try {
      const result = await attempt.run();
      return { provider: attempt.provider, ...result };
    } catch (error) {
      errors.push({ provider: attempt.provider, error: formatError(error) });
    }
  }

  const tried = errors.map((e) => `${e.provider}: ${e.error}`).join(' | ');
  throw new Error(`[finance] ${label} failed. Tried ${Array.from(allowed).join(', ')}. ${tried}`);
}
