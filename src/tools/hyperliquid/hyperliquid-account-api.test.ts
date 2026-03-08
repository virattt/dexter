import { describe, expect, test, afterEach } from 'bun:test';
import {
  getHLAccountAddress,
  isHLAccountConfigured,
  normalizeClearinghouseState,
  type HLClearinghouseStateRaw,
} from './hyperliquid-account-api.js';

describe('hyperliquid-account-api', () => {
  const VALID_ADDRESS = '0x31ca8395cf837de08b24da3f660e77761dfb974b';

  afterEach(() => {
    delete process.env.HYPERLIQUID_ACCOUNT_ADDRESS;
  });

  describe('getHLAccountAddress', () => {
    test('returns null when HYPERLIQUID_ACCOUNT_ADDRESS is unset', () => {
      expect(getHLAccountAddress()).toBeNull();
    });

    test('returns null when empty string', () => {
      process.env.HYPERLIQUID_ACCOUNT_ADDRESS = '';
      expect(getHLAccountAddress()).toBeNull();
    });

    test('returns null when invalid format (short)', () => {
      process.env.HYPERLIQUID_ACCOUNT_ADDRESS = '0x1234';
      expect(getHLAccountAddress()).toBeNull();
    });

    test('returns null when not hex', () => {
      process.env.HYPERLIQUID_ACCOUNT_ADDRESS = '0x31ca8395cf837de08b24da3f660e77761dfb974g';
      expect(getHLAccountAddress()).toBeNull();
    });

    test('returns address when valid 42-char hex', () => {
      process.env.HYPERLIQUID_ACCOUNT_ADDRESS = VALID_ADDRESS;
      expect(getHLAccountAddress()).toBe(VALID_ADDRESS);
    });

    test('trims whitespace and returns address', () => {
      process.env.HYPERLIQUID_ACCOUNT_ADDRESS = '  ' + VALID_ADDRESS + '  ';
      expect(getHLAccountAddress()).toBe(VALID_ADDRESS);
    });
  });

  describe('isHLAccountConfigured', () => {
    test('returns false when address not set', () => {
      expect(isHLAccountConfigured()).toBe(false);
    });

    test('returns true when valid address set', () => {
      process.env.HYPERLIQUID_ACCOUNT_ADDRESS = VALID_ADDRESS;
      expect(isHLAccountConfigured()).toBe(true);
    });
  });

  describe('normalizeClearinghouseState', () => {
    test('normalizes empty assetPositions and uses marginSummary accountValue', () => {
      const raw: HLClearinghouseStateRaw = {
        marginSummary: { accountValue: '1000.50' },
        withdrawable: '900',
        assetPositions: [],
        time: 1700000000000,
      };
      const out = normalizeClearinghouseState(raw, VALID_ADDRESS);
      expect(out.accountAddress).toBe(VALID_ADDRESS);
      expect(out.accountValue).toBe(1000.5);
      expect(out.withdrawable).toBe(900);
      expect(out.positions).toHaveLength(0);
      expect(out.time).toBe(1700000000000);
    });

    test('normalizes positions and computes weightPct', () => {
      const raw: HLClearinghouseStateRaw = {
        marginSummary: { accountValue: '1000' },
        withdrawable: '800',
        assetPositions: [
          {
            position: {
              coin: 'ETH',
              szi: '0.5',
              entryPx: '3000',
              positionValue: '600',
            },
          },
          {
            position: {
              coin: 'BTC',
              szi: '0.01',
              entryPx: '40000',
              positionValue: '400',
            },
          },
        ],
        time: 1700000000000,
      };
      const out = normalizeClearinghouseState(raw, VALID_ADDRESS);
      expect(out.positions).toHaveLength(2);
      const eth = out.positions.find((p) => p.symbol === 'ETH');
      const btc = out.positions.find((p) => p.symbol === 'BTC');
      expect(eth).toBeDefined();
      expect(eth!.size).toBe(0.5);
      expect(eth!.entryPx).toBe(3000);
      expect(eth!.positionValue).toBe(600);
      expect(eth!.weightPct).toBe(60);
      expect(btc).toBeDefined();
      expect(btc!.positionValue).toBe(400);
      expect(btc!.weightPct).toBe(40);
    });

    test('skips positions without coin', () => {
      const raw: HLClearinghouseStateRaw = {
        marginSummary: { accountValue: '100' },
        assetPositions: [
          { position: { szi: '1', entryPx: '10', positionValue: '10' } },
          { position: { coin: 'SOL', szi: '1', entryPx: '100', positionValue: '100' } },
        ],
      };
      const out = normalizeClearinghouseState(raw, VALID_ADDRESS);
      expect(out.positions).toHaveLength(1);
      expect(out.positions[0]!.symbol).toBe('SOL');
    });

    test('uses crossMarginSummary when marginSummary accountValue missing', () => {
      const raw: HLClearinghouseStateRaw = {
        crossMarginSummary: { accountValue: '500.25' },
        withdrawable: '500',
        assetPositions: [],
      };
      const out = normalizeClearinghouseState(raw, VALID_ADDRESS);
      expect(out.accountValue).toBe(500.25);
    });
  });
});
