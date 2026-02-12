export type FinanceDataProviderId = 'financialdatasets' | 'fmp' | 'alphavantage';

export interface FinanceProviderResult<T> {
  provider: FinanceDataProviderId;
  data: T;
  /** Public URLs safe to show to the model/user (no API keys). */
  sourceUrls: string[];
}

export class MissingApiKeyError extends Error {
  readonly name = 'MissingApiKeyError';
  constructor(public readonly envVar: string) {
    super(`Missing required environment variable: ${envVar}`);
  }
}
