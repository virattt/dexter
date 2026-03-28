import { describe, it, expect } from 'bun:test';
import {
  computeCostOfEquity,
  computeWacc,
  estimateBetaFromSector,
  SECTOR_BETA_DEFAULTS,
  type WaccInputs,
} from './wacc';

// ─── computeCostOfEquity ────────────────────────────────────────────────────

describe('computeCostOfEquity (CAPM)', () => {
  it('Ke = rfr + beta * erp', () => {
    // rfr=4%, beta=1.2, erp=5.5% → Ke = 4 + 1.2*5.5 = 4 + 6.6 = 10.6%
    expect(computeCostOfEquity(1.2, 0.04, 0.055)).toBeCloseTo(0.106, 6);
  });

  it('beta=1 → Ke = rfr + erp (the market return)', () => {
    expect(computeCostOfEquity(1.0, 0.04, 0.055)).toBeCloseTo(0.095, 6);
  });

  it('beta=0 → Ke equals the risk-free rate', () => {
    expect(computeCostOfEquity(0, 0.04, 0.055)).toBeCloseTo(0.04, 6);
  });

  it('high-beta stock has higher cost of equity', () => {
    const ke_low = computeCostOfEquity(0.5, 0.04, 0.055);
    const ke_high = computeCostOfEquity(1.8, 0.04, 0.055);
    expect(ke_high).toBeGreaterThan(ke_low);
  });
});

// ─── computeWacc ────────────────────────────────────────────────────────────

describe('computeWacc', () => {
  const base: WaccInputs = {
    beta: 1.0,
    rfr: 0.04,
    erp: 0.055,
    deRatio: 0.5,     // 50% D/E → E/V = 66.7%, D/V = 33.3%
    costOfDebt: 0.05,
    taxRate: 0.21,
  };

  it('produces a number in a reasonable range (5–20%)', () => {
    const w = computeWacc(base);
    expect(w).toBeGreaterThan(0.05);
    expect(w).toBeLessThan(0.20);
  });

  it('manual example: beta=1, rfr=4%, erp=5.5%, D/E=0.5, Kd=5%, T=21%', () => {
    // Ke = 4% + 1.0×5.5% = 9.5%
    // E/V = 1/(1+0.5) = 0.6667, D/V = 0.5/(1+0.5) = 0.3333
    // after-tax Kd = 5% × (1 − 0.21) = 3.95%
    // WACC = 0.6667×9.5% + 0.3333×3.95% = 6.333% + 1.317% ≈ 7.65%
    expect(computeWacc(base)).toBeCloseTo(0.0765, 3);
  });

  it('zero debt → WACC equals the cost of equity', () => {
    const noDebt = { ...base, deRatio: 0 };
    const ke = computeCostOfEquity(base.beta, base.rfr, base.erp);
    expect(computeWacc(noDebt)).toBeCloseTo(ke, 8);
  });

  it('higher beta → higher WACC (all else equal)', () => {
    const w_low = computeWacc({ ...base, beta: 0.7 });
    const w_high = computeWacc({ ...base, beta: 1.5 });
    expect(w_high).toBeGreaterThan(w_low);
  });

  it('higher tax rate → lower WACC (debt shield is worth more)', () => {
    const w_low_tax = computeWacc({ ...base, taxRate: 0.1 });
    const w_high_tax = computeWacc({ ...base, taxRate: 0.35 });
    expect(w_high_tax).toBeLessThan(w_low_tax);
  });

  it('higher D/E ratio shifts WACC toward cost of debt', () => {
    // With Kd < Ke, more debt should lower WACC (up to financial distress)
    const w_low_debt = computeWacc({ ...base, deRatio: 0.1 });
    const w_high_debt = computeWacc({ ...base, deRatio: 2.0 });
    // Ke=9.5%, after-tax Kd=3.95%, so more debt → lower WACC
    expect(w_high_debt).toBeLessThan(w_low_debt);
  });

  it('higher risk-free rate → higher WACC', () => {
    const w_low = computeWacc({ ...base, rfr: 0.02 });
    const w_high = computeWacc({ ...base, rfr: 0.06 });
    expect(w_high).toBeGreaterThan(w_low);
  });

  it('returns number between 0 and 1 for any reasonable inputs', () => {
    const cases: WaccInputs[] = [
      { beta: 0.3, rfr: 0.03, erp: 0.05, deRatio: 0.0, costOfDebt: 0.04, taxRate: 0.25 }, // utility
      { beta: 1.5, rfr: 0.05, erp: 0.06, deRatio: 1.0, costOfDebt: 0.07, taxRate: 0.21 }, // tech
      { beta: 0.8, rfr: 0.04, erp: 0.055, deRatio: 0.3, costOfDebt: 0.05, taxRate: 0.22 }, // staples
    ];
    for (const c of cases) {
      const w = computeWacc(c);
      expect(w).toBeGreaterThan(0);
      expect(w).toBeLessThan(1);
    }
  });
});

// ─── estimateBetaFromSector ─────────────────────────────────────────────────

describe('estimateBetaFromSector', () => {
  it('returns a known beta for Information Technology', () => {
    expect(estimateBetaFromSector('Information Technology')).toBeCloseTo(
      SECTOR_BETA_DEFAULTS['Information Technology']!,
      6,
    );
  });

  it('returns 1.0 for unknown sector (market-average fallback)', () => {
    expect(estimateBetaFromSector('Unknown Sector XYZ')).toBe(1.0);
  });

  it('utilities have a lower beta than technology', () => {
    expect(estimateBetaFromSector('Utilities')).toBeLessThan(
      estimateBetaFromSector('Information Technology'),
    );
  });

  it('all default betas are positive and reasonable (0.2–2.5)', () => {
    for (const [sector, beta] of Object.entries(SECTOR_BETA_DEFAULTS)) {
      expect(beta).toBeGreaterThan(0.2);
      expect(beta).toBeLessThan(2.5);
      // suppress unused var warning
      void sector;
    }
  });
});
