/**
 * Provider Registry
 * 
 * Manages provider lifecycle, routing, and fallback for the provider abstraction layer.
 */

import type {
  FinancialDataProvider,
  IProviderRegistry,
  ProviderCapabilities,
} from './types.js';
import { ProviderError, ProviderErrorCode } from './types.js';

// Import all providers
import { financialDatasetsProvider } from './financial-datasets-provider.js';
import { growwProvider } from './groww-provider.js';
import { zerodhaProvider } from './zerodha-provider.js';
import { yahooProvider } from './yahoo-provider.js';

/**
 * Provider priority order for different capabilities
 */
const PROVIDER_PRIORITY: Record<string, string[]> = {
  livePrices: ['groww', 'zerodha', 'yahoo'],
  historicalData: ['zerodha', 'yahoo'],
  incomeStatements: ['financial-datasets'],
  balanceSheets: ['financial-datasets'],
  cashFlowStatements: ['financial-datasets'],
  keyRatios: ['financial-datasets'],
  analystEstimates: ['financial-datasets'],
  orderPlacement: ['groww', 'zerodha'],
  positions: ['groww', 'zerodha'],
  holdings: ['groww', 'zerodha'],
};

/**
 * Provider Registry implementation
 */
export class ProviderRegistry implements IProviderRegistry {
  private providers: Map<string, FinancialDataProvider> = new Map();
  private initialized: boolean = false;

  constructor() {
    // Register all providers
    this.registerProvider(financialDatasetsProvider);
    this.registerProvider(growwProvider);
    this.registerProvider(zerodhaProvider);
    this.registerProvider(yahooProvider);
  }

  /**
   * Register a provider
   */
  private registerProvider(provider: FinancialDataProvider): void {
    if (provider.config.enabled !== false) {
      this.providers.set(provider.config.id, provider);
    }
  }

  /**
   * Initialize all available providers
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const initPromises: Promise<void>[] = [];
    
    for (const [id, provider] of Array.from(this.providers.entries())) {
      if (provider.isAvailable() && provider.initialize) {
        initPromises.push(
          provider.initialize().catch(err => {
            console.warn(`Provider ${id} initialization failed:`, err);
            this.providers.delete(id);
          })
        );
      } else if (!provider.isAvailable()) {
        console.log(`Provider ${id} not available (credentials not configured)`);
        this.providers.delete(id);
      }
    }

    await Promise.all(initPromises);
    this.initialized = true;
    
    console.log(`Provider registry initialized with ${this.providers.size} providers`);
  }

  /**
   * Get provider by ID
   */
  getProvider(id: string): FinancialDataProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Get all available providers
   */
  getAvailableProviders(): FinancialDataProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get providers that support a capability
   */
  getProvidersForCapability(capability: keyof ProviderCapabilities): FinancialDataProvider[] {
    const available = this.getAvailableProviders();
    return available.filter(p => p.supportsCapability(capability));
  }

  /**
   * Get best provider for capability
   */
  getProviderForCapability(
    capability: keyof ProviderCapabilities,
    preferredProvider?: string
  ): FinancialDataProvider | null {
    // If preferred provider specified and supports capability
    if (preferredProvider) {
      const provider = this.providers.get(preferredProvider);
      if (provider && provider.isAvailable() && provider.supportsCapability(capability)) {
        return provider;
      }
    }

    // Get priority list for this capability
    const priorityList = PROVIDER_PRIORITY[capability] || [];

    // Find first available provider in priority order
    for (const providerId of priorityList) {
      const provider = this.providers.get(providerId);
      if (provider && provider.isAvailable() && provider.supportsCapability(capability)) {
        return provider;
      }
    }

    // Fallback: find any provider that supports the capability
    const fallback = this.getProvidersForCapability(capability);
    return fallback.length > 0 ? fallback[0] : null;
  }

  /**
   * Execute operation with fallback
   */
  async executeWithFallback<T>(
    capability: keyof ProviderCapabilities,
    operation: (provider: FinancialDataProvider) => Promise<T>,
    preferredProvider?: string
  ): Promise<T> {
    const providers = this.getProvidersForCapability(capability);
    
    if (providers.length === 0) {
      throw new ProviderError(
        `No provider available for capability: ${capability}`,
        'registry',
        ProviderErrorCode.NOT_FOUND,
        false
      );
    }

    // Sort by priority
    const priorityList = PROVIDER_PRIORITY[capability] || [];
    providers.sort((a, b) => {
      const aIdx = priorityList.indexOf(a.config.id);
      const bIdx = priorityList.indexOf(b.config.id);
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });

    const errors: Error[] = [];

    for (const provider of providers) {
      try {
        return await operation(provider);
      } catch (error) {
        const providerError = error as ProviderError;
        
        // Non-retryable errors: fail fast
        if (!providerError.retryable) {
          throw error;
        }
        
        errors.push(providerError);
        console.warn(`Provider ${provider.config.id} failed, trying next...`);
      }
    }

    // All providers failed
    throw new ProviderError(
      `All providers failed for ${capability}: ${errors.map(e => e.message).join(', ')}`,
      'registry',
      ProviderErrorCode.PROVIDER_ERROR,
      false,
      undefined,
      errors
    );
  }
}

// Export singleton instance
export const providerRegistry = new ProviderRegistry();
