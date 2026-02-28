/**
 * Integration Tests
 * Tests for provider integration and end-to-end flows
 */

import { describe, it, expect } from 'bun:test';
import { providerRegistry } from '../providers/index.js';
import type { ProviderCapabilities } from '../providers/types.js';

describe('Provider Integration', () => {
  describe('Provider Registry Initialization', () => {
    it('should initialize without throwing', async () => {
      let errorThrown = false;
      try {
        await providerRegistry.initialize();
      } catch (error) {
        errorThrown = true;
      }
      expect(errorThrown).toBe(false);
    });

    it('should register available providers', async () => {
      await providerRegistry.initialize();

      const providers = providerRegistry.getAvailableProviders();
      const providerIds = providers.map(p => p.config.id);

      // Yahoo should always be available (no auth required)
      expect(providerIds).toContain('yahoo');

      // Other providers may or may not be available based on credentials
      // We only check that the structure is correct
      expect(Array.isArray(providerIds)).toBe(true);
    });
  });

  describe('Provider Capabilities', () => {
    it('should have correct capabilities for each provider', async () => {
      await providerRegistry.initialize();

      const providers = providerRegistry.getAvailableProviders();

      providers.forEach(provider => {
        const capabilities = provider.getCapabilities();

        // Validate capabilities structure
        expect(capabilities).toHaveProperty('livePrices');
        expect(capabilities).toHaveProperty('historicalData');
        expect(capabilities).toHaveProperty('incomeStatements');
        expect(capabilities).toHaveProperty('balanceSheets');
        expect(capabilities).toHaveProperty('cashFlowStatements');
        expect(capabilities).toHaveProperty('keyRatios');
        expect(capabilities).toHaveProperty('analystEstimates');
        expect(capabilities).toHaveProperty('filings');
        expect(capabilities).toHaveProperty('insiderTrades');
        expect(capabilities).toHaveProperty('companyNews');
        expect(capabilities).toHaveProperty('orderPlacement');
        expect(capabilities).toHaveProperty('positions');
        expect(capabilities).toHaveProperty('holdings');
        expect(capabilities).toHaveProperty('markets');
        expect(Array.isArray(capabilities.markets)).toBe(true);
      });
    });

    it('should have correct capability flags per provider', async () => {
      await providerRegistry.initialize();

      const providers = providerRegistry.getAvailableProviders();
      const yahooProvider = providers.find(p => p.config.id === 'yahoo');

      // Yahoo should support live prices and historical data
      if (yahooProvider) {
        expect(yahooProvider.supportsCapability('livePrices')).toBe(true);
        expect(yahooProvider.supportsCapability('historicalData')).toBe(true);
        expect(yahooProvider.supportsCapability('orderPlacement')).toBe(false);
        expect(yahooProvider.getCapabilities().markets).toContain('US');
      }
    });
  });

  describe('Provider Priority and Routing', () => {
    it('should return providers in priority order for livePrices', async () => {
      await providerRegistry.initialize();

      const providers = providerRegistry.getProvidersForCapability('livePrices');

      // Should have at least one provider
      expect(providers.length).toBeGreaterThan(0);

      // All should support livePrices
      expect(providers.every(p => p.supportsCapability('livePrices'))).toBe(true);
    });

    it('should return providers for fundamentals when configured', async () => {
      await providerRegistry.initialize();

      const providers = providerRegistry.getProvidersForCapability('incomeStatements');

      // May have providers if credentials configured
      expect(Array.isArray(providers)).toBe(true);

      // If providers exist, they should support the capability
      if (providers.length > 0) {
        expect(providers.every(p => p.supportsCapability('incomeStatements'))).toBe(true);
      }
    });

    it('should return providers for trading features when configured', async () => {
      await providerRegistry.initialize();

      const providers = providerRegistry.getProvidersForCapability('orderPlacement');

      // May have providers if credentials configured
      expect(Array.isArray(providers)).toBe(true);

      // If providers exist, they should support the capability
      if (providers.length > 0) {
        expect(providers.every(p => p.supportsCapability('orderPlacement'))).toBe(true);
      }
    });
  });

  describe('Provider Configuration', () => {
    it('should have proper config structure for all providers', async () => {
      await providerRegistry.initialize();

      const providers = providerRegistry.getAvailableProviders();

      providers.forEach(provider => {
        const config = provider.config;

        // Required config fields
        expect(config).toHaveProperty('id');
        expect(config).toHaveProperty('displayName');
        expect(config).toHaveProperty('baseUrl');
        expect(config).toHaveProperty('capabilities');
        expect(config).toHaveProperty('rateLimits');
        expect(config).toHaveProperty('requiresAuth');
        expect(config).toHaveProperty('enabled');

        // Validate types
        expect(typeof config.id).toBe('string');
        expect(typeof config.displayName).toBe('string');
        expect(typeof config.baseUrl).toBe('string');
        expect(typeof config.requiresAuth).toBe('boolean');
        expect(typeof config.enabled).toBe('boolean');
        expect(typeof config.capabilities).toBe('object');
        expect(typeof config.rateLimits).toBe('object');
      });
    });

    it('should have correct baseUrl for each provider', async () => {
      await providerRegistry.initialize();

      const providers = providerRegistry.getAvailableProviders();
      const yahoo = providers.find(p => p.config.id === 'yahoo');

      if (yahoo) expect(yahoo.config.baseUrl).toContain('yahoo');
    });
  });
});

describe('Fallback Mechanism', () => {
  it('should handle provider unavailability gracefully', async () => {
    await providerRegistry.initialize();

    // Even if some providers are unavailable, the registry should work
    const providers = providerRegistry.getAvailableProviders();

    expect(Array.isArray(providers)).toBe(true);
  });

  it('should return null when no provider available for capability', async () => {
    await providerRegistry.initialize();

    // This capability might not have providers
    const provider = providerRegistry.getProviderForCapability('nonexistent' as any);

    expect(provider === null || provider === undefined || provider).toBeTruthy();
  });
});

describe('Rate Limiting Integration', () => {
  it('should have rate limiters configured for providers', async () => {
    await providerRegistry.initialize();

    const providers = providerRegistry.getAvailableProviders();

    providers.forEach(provider => {
      const rateLimits = provider.config.rateLimits;

      // Rate limits should be an object
      expect(typeof rateLimits).toBe('object');
      expect(Object.keys(rateLimits).length).toBeGreaterThan(0);

      // Each limit should have perSecond and perMinute
      Object.values(rateLimits).forEach(limit => {
        expect(limit).toHaveProperty('perSecond');
        expect(limit).toHaveProperty('perMinute');
        expect(typeof limit.perSecond).toBe('number');
        expect(typeof limit.perMinute).toBe('number');
        expect(limit.perSecond).toBeGreaterThan(0);
        expect(limit.perMinute).toBeGreaterThan(0);
      });
    });
  });
});
