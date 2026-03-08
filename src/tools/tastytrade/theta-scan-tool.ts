import { DynamicStructuredTool } from '@langchain/core/tools';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { getBalances, getOptionChain, getPositions, getQuotes } from './api.js';
import { getCredentialsPath, hasValidToken } from './auth.js';
import {
  buildOrderJson,
  candidateScore,
  detectUnderlyingInstrumentType,
  extractOptionContracts,
  extractQuoteMap,
  OptionContract,
} from './theta-helpers.js';
import {
  availableBuyingPowerFromBalances,
  computePortfolioFit,
  getFirstAccountNumber,
  hasEarningsInWindow,
  loadSoulPortfolioContext,
  loadThetaPolicy,
  normalizePositions,
  totalEquityFromBalances,
} from './utils.js';

const THETA_POLICY_PATH = join(homedir(), '.dexter', 'THETA-POLICY.md');

const schema = z.object({
  account_number: z.string().optional().describe('Tastytrade account number. If omitted, uses the first linked account.'),
  underlyings_csv: z
    .string()
    .optional()
    .describe('Comma-separated underlyings to scan. Defaults to THETA-POLICY allowed underlyings.'),
  strategy_type: z
    .enum(['covered_call', 'cash_secured_put', 'credit_spread', 'iron_condor'])
    .optional()
    .default('credit_spread')
    .describe('Strategy type to scan for.'),
  min_dte: z.number().optional().describe('Minimum DTE. Defaults to THETA-POLICY or conservative default.'),
  max_dte: z.number().optional().describe('Maximum DTE. Defaults to THETA-POLICY or conservative default.'),
  short_delta_min: z.number().optional().describe('Minimum short delta. Defaults to THETA-POLICY.'),
  short_delta_max: z.number().optional().describe('Maximum short delta. Defaults to THETA-POLICY.'),
  spread_width: z.number().optional().default(5).describe('Preferred spread width in strike points.'),
  min_credit: z.number().optional().default(0.5).describe('Minimum credit required per spread or option sold.'),
  max_results: z.number().optional().default(5).describe('Maximum candidates to return.'),
  exclude_earnings: z
    .boolean()
    .optional()
    .describe('When true and THETA-POLICY has exclude_earnings_days > 0, filter out underlyings with earnings in that window. Default true.'),
});

type Candidate = {
  underlying: string;
  strategy_type: 'covered_call' | 'cash_secured_put' | 'credit_spread' | 'iron_condor';
  expiration_date: string | null;
  dte: number | null;
  estimated_credit: number;
  max_loss: number | null;
  buying_power_estimate: number;
  short_delta: number | null;
  policy_ok: boolean;
  policy_notes: string[];
  legs: Array<{ symbol: string; action: string; quantity: number; instrument_type: string; strike?: number }>;
  order_json: string;
  score: number;
  portfolio_fit?: { result: 'pass' | 'warn' | 'block'; reason: string };
};

export const tastytradeThetaScanTool = new DynamicStructuredTool({
  name: 'tastytrade_theta_scan',
  description:
    'Scan theta setups (covered calls, cash-secured puts, credit spreads, iron condors) using tastytrade positions, balances, option chains, and policy defaults.',
  schema,
  func: async (input) => {
    const policy = loadThetaPolicy();
    const hasThetaPolicyFile = existsSync(THETA_POLICY_PATH);
    const tastytradeEnvConfigured = Boolean(
      process.env.TASTYTRADE_CLIENT_ID && process.env.TASTYTRADE_CLIENT_SECRET
    );
    const tastytradeTokenReady = hasValidToken();

    if (!tastytradeEnvConfigured || !tastytradeTokenReady) {
      return JSON.stringify({
        error: 'tastytrade setup incomplete for theta scan.',
        setup_required: true,
        environment_status: {
          theta_policy_present: hasThetaPolicyFile,
          theta_policy_path: THETA_POLICY_PATH,
          tastytrade_env_configured: tastytradeEnvConfigured,
          tastytrade_token_ready: tastytradeTokenReady,
          tastytrade_credentials_path: getCredentialsPath(),
        },
        next_steps: [
          hasThetaPolicyFile
            ? 'THETA-POLICY.md is present. Review the allowed underlyings, no-call list, and sizing caps before scanning.'
            : 'Create ~/.dexter/THETA-POLICY.md from docs/THETA-POLICY.example.md or run /theta-policy first.',
          tastytradeEnvConfigured
            ? 'tastytrade client id and secret look configured.'
            : 'Set TASTYTRADE_CLIENT_ID and TASTYTRADE_CLIENT_SECRET in your environment first.',
          tastytradeTokenReady
            ? 'tastytrade credentials appear usable.'
            : 'Add or refresh ~/.dexter/tastytrade-credentials.json so tastytrade auth is usable before scanning.',
          'After setup, run /theta-help, then /theta-risk, then /theta-scan.',
        ],
        policy_defaults_if_missing: !hasThetaPolicyFile
          ? {
              allowed_underlyings: policy.allowedUnderlyings,
              short_delta_range: [policy.shortDeltaMin, policy.shortDeltaMax],
              dte_range: [policy.minDte, policy.maxDte],
              max_risk_per_trade_pct: policy.maxRiskPerTradePct,
              max_buying_power_usage_pct: policy.maxBuyingPowerUsagePct,
            }
          : null,
      });
    }

    const accountNumber = input.account_number ?? (await getFirstAccountNumber());
    if (!accountNumber) {
      return JSON.stringify({
        error: 'No tastytrade account found. Provide account_number or link an account.',
        setup_required: true,
        environment_status: {
          theta_policy_present: hasThetaPolicyFile,
          theta_policy_path: THETA_POLICY_PATH,
          tastytrade_env_configured: tastytradeEnvConfigured,
          tastytrade_token_ready: tastytradeTokenReady,
          tastytrade_credentials_path: getCredentialsPath(),
        },
        next_steps: [
          'Check that tastytrade authentication is valid and that /customers/me/accounts returns at least one linked account.',
          'If you have multiple accounts, pass account_number explicitly.',
          'Run /theta-help for the recommended Phase 5 operating loop.',
        ],
      });
    }

    let underlyings =
      input.underlyings_csv
        ?.split(',')
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean) ?? policy.allowedUnderlyings;

    const excludeEarnings =
      input.exclude_earnings ?? (policy.excludeEarningsDays > 0);
    let excludedByEarnings: string[] = [];
    if (excludeEarnings && policy.excludeEarningsDays > 0) {
      const inWindow = await Promise.all(
        underlyings.map((u) => hasEarningsInWindow(u, policy.excludeEarningsDays))
      );
      excludedByEarnings = underlyings.filter((_, i) => inWindow[i]);
      underlyings = underlyings.filter((_, i) => !inWindow[i]);
    }

    const minDte = input.min_dte ?? policy.minDte;
    const maxDte = input.max_dte ?? policy.maxDte;
    const shortDeltaMin = input.short_delta_min ?? policy.shortDeltaMin;
    const shortDeltaMax = input.short_delta_max ?? policy.shortDeltaMax;
    const spreadWidth = input.spread_width ?? 5;
    const minCredit = input.min_credit ?? 0.5;
    const maxResults = input.max_results ?? 5;

    try {
      const [balancesRes, positionsRes] = await Promise.all([getBalances(accountNumber), getPositions(accountNumber)]);
      const buyingPower = availableBuyingPowerFromBalances(balancesRes.data);
      const totalEquity = totalEquityFromBalances(balancesRes.data);
      const positions = normalizePositions(positionsRes.data);

      const allCandidates: Candidate[] = [];
      for (const underlying of underlyings) {
        const instrumentType = detectUnderlyingInstrumentType(underlying);
        const [underlyingQuoteRes, chainRes] = await Promise.all([
          getQuotes([underlying], instrumentType),
          getOptionChain(underlying),
        ]);
        const underlyingQuote = extractQuoteMap(underlyingQuoteRes.data).get(underlying);
        const underlyingPrice = underlyingQuote?.mark || underlyingQuote?.last || 0;
        if (!underlyingPrice) continue;

        const contracts = extractOptionContracts(chainRes.data).filter(
          (contract) => contract.dte != null && contract.dte >= minDte && contract.dte <= maxDte
        );
        const contractSymbols = contracts.map((contract) => contract.symbol);
        if (contractSymbols.length === 0) continue;
        const optionQuotesRes = await getQuotes(contractSymbols, 'Equity Option');
        const optionQuotes = extractQuoteMap(optionQuotesRes.data);

        const instrumentTypeForLeg = instrumentType === 'Index' ? 'Index Option' : 'Equity Option';
        if (input.strategy_type === 'covered_call') {
          allCandidates.push(
            ...scanCoveredCalls({
              positions,
              underlying,
              underlyingPrice,
              contracts,
              optionQuotes,
              minCredit,
              shortDeltaMin,
              shortDeltaMax,
              noCallList: policy.noCallList,
              instrumentTypeForLeg,
            })
          );
        } else if (input.strategy_type === 'cash_secured_put') {
          allCandidates.push(
            ...scanCashSecuredPuts({
              underlying,
              underlyingPrice,
              contracts,
              optionQuotes,
              minCredit,
              shortDeltaMin,
              shortDeltaMax,
              buyingPower,
              instrumentTypeForLeg,
            })
          );
        } else if (input.strategy_type === 'credit_spread') {
          allCandidates.push(
            ...scanCreditSpreads({
              underlying,
              underlyingPrice,
              contracts,
              optionQuotes,
              minCredit,
              shortDeltaMin,
              shortDeltaMax,
              spreadWidth,
              buyingPower,
              instrumentTypeForLeg,
            })
          );
        } else if (input.strategy_type === 'iron_condor') {
          allCandidates.push(
            ...scanIronCondors({
              underlying,
              underlyingPrice,
              contracts,
              optionQuotes,
              minCredit,
              shortDeltaMin,
              shortDeltaMax,
              spreadWidth,
              buyingPower,
              instrumentTypeForLeg,
            })
          );
        }
      }

      const soulPortfolio = loadSoulPortfolioContext();
      const currentWeightByTicker: Record<string, number> = {};
      for (const p of positions) {
        const u = p.underlying;
        if (u && u !== '—') {
          currentWeightByTicker[u] = (currentWeightByTicker[u] ?? 0) + (p.value ?? 0);
        }
      }
      const totalEquityNum = totalEquity > 0 ? totalEquity : 1;
      for (const u of Object.keys(currentWeightByTicker)) {
        currentWeightByTicker[u] = (currentWeightByTicker[u]! / totalEquityNum) * 100;
      }

      const finalCandidates = allCandidates
        .map((candidate) => applyPolicy(candidate, {
          totalEquity,
          maxRiskPerTradePct: policy.maxRiskPerTradePct,
          maxBuyingPowerUsagePct: policy.maxBuyingPowerUsagePct,
        }))
        .map((c) => {
          const notes = [...c.policy_notes];
          const tradeExposurePct =
            (c.buying_power_estimate > 0 ? c.buying_power_estimate : (c.max_loss ?? 0)) / totalEquityNum * 100;
          const fit = computePortfolioFit({
            underlying: c.underlying,
            soulCoreOrAvoidTickers: soulPortfolio.soulCoreOrAvoidTickers,
            portfolioTargetWeightByTicker: soulPortfolio.portfolioTargetWeightByTicker,
            currentWeightPct: currentWeightByTicker[c.underlying],
            tradeExposurePct,
            targetWeightPct: soulPortfolio.portfolioTargetWeightByTicker.get(c.underlying),
            isShortCall: c.legs.some(
              (leg) => leg.action === 'Sell to Open' && (leg.symbol?.includes('C') ?? false)
            ),
          });
          notes.push(`Portfolio fit: ${fit.result} — ${fit.reason}`);
          const scoreDelta = fit.result === 'block' ? -100 : fit.result === 'warn' ? -25 : 0;
          return {
            ...c,
            policy_notes: notes,
            portfolio_fit: { result: fit.result, reason: fit.reason },
            score: c.score + scoreDelta,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);

      return JSON.stringify({
        account_number: accountNumber,
        strategy_type: input.strategy_type,
        policy,
        theta_policy_present: hasThetaPolicyFile,
        soul_portfolio_checked: soulPortfolio.soulCoreOrAvoidTickers.length > 0 || soulPortfolio.portfolioTargetWeightByTicker.size > 0,
        excluded_by_earnings: excludedByEarnings,
        total_equity: totalEquity,
        buying_power: buyingPower,
        candidates: finalCandidates,
        notes: [
          hasThetaPolicyFile
            ? 'THETA-POLICY.md is present and its defaults were applied unless you overrode them in the tool input.'
            : 'THETA-POLICY.md is missing, so conservative defaults were used. Run /theta-policy to create one.',
          'Greeks and IV are best-effort from tastytrade quote data when available.',
          excludedByEarnings.length > 0
            ? `Earnings exclusion applied in-tool: ${excludedByEarnings.join(', ')} excluded (earnings within ${policy.excludeEarningsDays} days).`
            : policy.excludeEarningsDays > 0
              ? 'Earnings exclusion was applied when exclude_earnings=true; no underlyings were in the earnings window.'
              : 'Earnings/event filtering can be enabled via THETA-POLICY exclude earnings days and exclude_earnings=true.',
          minDte <= 1
            ? 'For 0DTE or very short DTE, check Fed/CPI/macro calendar before trading; event days may warrant wider strikes or sitting out.'
            : null,
          soulPortfolio.soulCoreOrAvoidTickers.length > 0 || soulPortfolio.portfolioTargetWeightByTicker.size > 0
            ? 'SOUL.md and PORTFOLIO.md were used to flag Core/Avoid tickers and target weights where present.'
            : 'SOUL.md or PORTFOLIO.md not found; run /theta-scan after syncing portfolio for full portfolio-aware notes.',
        ].filter(Boolean),
      });
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        setup_required: true,
        environment_status: {
          theta_policy_present: hasThetaPolicyFile,
          theta_policy_path: THETA_POLICY_PATH,
          tastytrade_env_configured: tastytradeEnvConfigured,
          tastytrade_token_ready: tastytradeTokenReady,
          tastytrade_credentials_path: getCredentialsPath(),
        },
        next_steps: [
          hasThetaPolicyFile
            ? 'THETA-POLICY.md is present.'
            : 'Create ~/.dexter/THETA-POLICY.md from docs/THETA-POLICY.example.md or run /theta-policy.',
          'Confirm tastytrade auth by checking that accounts, balances, and positions can be fetched successfully.',
          'Then rerun /theta-help and /theta-scan.',
        ],
      });
    }
  },
});

function scanCoveredCalls(params: {
  positions: ReturnType<typeof normalizePositions>;
  underlying: string;
  underlyingPrice: number;
  contracts: OptionContract[];
  optionQuotes: ReturnType<typeof extractQuoteMap>;
  minCredit: number;
  shortDeltaMin: number;
  shortDeltaMax: number;
  noCallList: string[];
  instrumentTypeForLeg: string;
}): Candidate[] {
  const longShares = params.positions
    .filter((position) => position.underlying === params.underlying && !position.optionType && position.quantity > 0)
    .reduce((sum, position) => sum + position.quantity, 0);
  const maxContracts = Math.floor(longShares / 100);
  if (maxContracts <= 0) return [];
  const candidates: Candidate[] = [];
  for (const contract of params.contracts.filter((candidate) => candidate.optionType === 'C' && candidate.strike > params.underlyingPrice)) {
    const quote = params.optionQuotes.get(contract.symbol);
    if (!quote) continue;
    const credit = quote.mark;
    const delta = Math.abs(quote.delta ?? approximateDelta(contract.strike, params.underlyingPrice));
    if (credit < params.minCredit) continue;
    if (delta < params.shortDeltaMin || delta > params.shortDeltaMax) continue;

    const policyNotes = params.noCallList.includes(params.underlying)
      ? [`${params.underlying} is on the no-call list.`]
      : [];
    const order = buildOrderJson({
      price: credit,
      legs: [
        {
          symbol: contract.symbol,
          quantity: 1,
          action: 'Sell to Open',
          instrument_type: params.instrumentTypeForLeg,
        },
      ],
    });

    candidates.push({
      underlying: params.underlying,
      strategy_type: 'covered_call',
      expiration_date: contract.expirationDate,
      dte: contract.dte,
      estimated_credit: Number(credit.toFixed(2)),
      max_loss: null,
      buying_power_estimate: 0,
      short_delta: Number(delta.toFixed(4)),
      policy_ok: policyNotes.length === 0,
      policy_notes: policyNotes,
      legs: [{ symbol: contract.symbol, action: 'Sell to Open', quantity: 1, instrument_type: params.instrumentTypeForLeg, strike: contract.strike }],
      order_json: JSON.stringify(order),
      score: candidateScore({
        credit,
        maxLoss: 1,
        deltaDistance: Math.abs(delta - 0.15),
        dteDistance: Math.abs((contract.dte ?? 0) - 7),
        policyPenalty: policyNotes.length ? 50 : 0,
      }),
    });
  }
  return candidates;
}

function scanCashSecuredPuts(params: {
  underlying: string;
  underlyingPrice: number;
  contracts: OptionContract[];
  optionQuotes: ReturnType<typeof extractQuoteMap>;
  minCredit: number;
  shortDeltaMin: number;
  shortDeltaMax: number;
  buyingPower: number;
  instrumentTypeForLeg: string;
}): Candidate[] {
  const candidates: Candidate[] = [];
  for (const contract of params.contracts.filter((candidate) => candidate.optionType === 'P' && candidate.strike < params.underlyingPrice)) {
    const quote = params.optionQuotes.get(contract.symbol);
    if (!quote) continue;
    const credit = quote.mark;
    const delta = Math.abs(quote.delta ?? approximateDelta(contract.strike, params.underlyingPrice));
    const collateral = contract.strike * 100;
    if (credit < params.minCredit || collateral > params.buyingPower) continue;
    if (delta < params.shortDeltaMin || delta > params.shortDeltaMax) continue;
    const order = buildOrderJson({
      price: credit,
      legs: [
        {
          symbol: contract.symbol,
          quantity: 1,
          action: 'Sell to Open',
          instrument_type: params.instrumentTypeForLeg,
        },
      ],
    });
    candidates.push({
      underlying: params.underlying,
      strategy_type: 'cash_secured_put',
      expiration_date: contract.expirationDate,
      dte: contract.dte,
      estimated_credit: Number(credit.toFixed(2)),
      max_loss: Number((contract.strike * 100 - credit * 100).toFixed(2)),
      buying_power_estimate: Number(collateral.toFixed(2)),
      short_delta: Number(delta.toFixed(4)),
      policy_ok: true,
      policy_notes: [],
      legs: [{ symbol: contract.symbol, action: 'Sell to Open', quantity: 1, instrument_type: params.instrumentTypeForLeg, strike: contract.strike }],
      order_json: JSON.stringify(order),
      score: candidateScore({
        credit,
        maxLoss: contract.strike - credit,
        deltaDistance: Math.abs(delta - 0.15),
        dteDistance: Math.abs((contract.dte ?? 0) - 14),
      }),
    });
  }
  return candidates;
}

function scanCreditSpreads(params: {
  underlying: string;
  underlyingPrice: number;
  contracts: OptionContract[];
  optionQuotes: ReturnType<typeof extractQuoteMap>;
  minCredit: number;
  shortDeltaMin: number;
  shortDeltaMax: number;
  spreadWidth: number;
  buyingPower: number;
  instrumentTypeForLeg: string;
}): Candidate[] {
  const puts = params.contracts.filter((contract) => contract.optionType === 'P' && contract.strike < params.underlyingPrice);
  const calls = params.contracts.filter((contract) => contract.optionType === 'C' && contract.strike > params.underlyingPrice);
  return [
    ...buildVerticalCandidates(puts, 'P', params),
    ...buildVerticalCandidates(calls, 'C', params),
  ];
}

function scanIronCondors(params: {
  underlying: string;
  underlyingPrice: number;
  contracts: OptionContract[];
  optionQuotes: ReturnType<typeof extractQuoteMap>;
  minCredit: number;
  shortDeltaMin: number;
  shortDeltaMax: number;
  spreadWidth: number;
  buyingPower: number;
  instrumentTypeForLeg: string;
}): Candidate[] {
  const spreads = scanCreditSpreads(params);
  const puts = spreads.filter((candidate) => candidate.legs.some((leg) => leg.symbol.includes('P')));
  const calls = spreads.filter((candidate) => candidate.legs.some((leg) => leg.symbol.includes('C')));
  const candidates: Candidate[] = [];

  for (const putSpread of puts.slice(0, 5)) {
    for (const callSpread of calls.slice(0, 5)) {
      if (putSpread.expiration_date !== callSpread.expiration_date) continue;
      const totalCredit = putSpread.estimated_credit + callSpread.estimated_credit;
      if (totalCredit < params.minCredit) continue;
      const putWidth = spreadWidthFromCandidate(putSpread);
      const callWidth = spreadWidthFromCandidate(callSpread);
      const width = Math.max(putWidth, callWidth);
      const maxLoss = Math.max(0, width * 100 - totalCredit * 100);
      if (maxLoss > params.buyingPower) continue;
      const order = buildOrderJson({
        price: totalCredit,
        legs: [
          ...JSON.parse(putSpread.order_json).legs,
          ...JSON.parse(callSpread.order_json).legs,
        ],
      });
      candidates.push({
        underlying: params.underlying,
        strategy_type: 'iron_condor',
        expiration_date: putSpread.expiration_date,
        dte: putSpread.dte,
        estimated_credit: Number(totalCredit.toFixed(2)),
        max_loss: Number(maxLoss.toFixed(2)),
        buying_power_estimate: Number((width * 100).toFixed(2)),
        short_delta: putSpread.short_delta,
        policy_ok: true,
        policy_notes: [],
        legs: [...putSpread.legs, ...callSpread.legs],
        order_json: JSON.stringify(order),
        score: candidateScore({
          credit: totalCredit,
          maxLoss: maxLoss / 100,
          deltaDistance: Math.abs((putSpread.short_delta ?? 0.15) - 0.15),
          dteDistance: Math.abs((putSpread.dte ?? 0) - 7),
        }),
      });
    }
  }

  return candidates;
}

function buildVerticalCandidates(
  contracts: OptionContract[],
  optionType: 'C' | 'P',
  params: {
    underlying: string;
    underlyingPrice: number;
    optionQuotes: ReturnType<typeof extractQuoteMap>;
    minCredit: number;
    shortDeltaMin: number;
    shortDeltaMax: number;
    spreadWidth: number;
    buyingPower: number;
    instrumentTypeForLeg: string;
  }
): Candidate[] {
  const candidates: Candidate[] = [];
  for (const shortLeg of contracts) {
    const shortQuote = params.optionQuotes.get(shortLeg.symbol);
    if (!shortQuote) continue;
    const delta = Math.abs(shortQuote.delta ?? approximateDelta(shortLeg.strike, params.underlyingPrice));
    if (delta < params.shortDeltaMin || delta > params.shortDeltaMax) continue;
    const targetStrike = optionType === 'P' ? shortLeg.strike - params.spreadWidth : shortLeg.strike + params.spreadWidth;
    const longLeg = findClosestStrike(
      contracts.filter((contract) => contract.expirationDate === shortLeg.expirationDate),
      targetStrike
    );
    if (!longLeg || longLeg.symbol === shortLeg.symbol) continue;
    const longQuote = params.optionQuotes.get(longLeg.symbol);
    if (!longQuote) continue;
    const credit = shortQuote.mark - longQuote.mark;
    const width = Math.abs(shortLeg.strike - longLeg.strike);
    const maxLoss = width * 100 - credit * 100;
    if (credit < params.minCredit || maxLoss <= 0 || maxLoss > params.buyingPower) continue;
    const legs =
      optionType === 'P'
        ? [
            { symbol: shortLeg.symbol, action: 'Sell to Open', quantity: 1, instrument_type: params.instrumentTypeForLeg, strike: shortLeg.strike },
            { symbol: longLeg.symbol, action: 'Buy to Open', quantity: 1, instrument_type: params.instrumentTypeForLeg, strike: longLeg.strike },
          ]
        : [
            { symbol: shortLeg.symbol, action: 'Sell to Open', quantity: 1, instrument_type: params.instrumentTypeForLeg, strike: shortLeg.strike },
            { symbol: longLeg.symbol, action: 'Buy to Open', quantity: 1, instrument_type: params.instrumentTypeForLeg, strike: longLeg.strike },
          ];
    const order = buildOrderJson({ price: credit, legs });
    candidates.push({
      underlying: params.underlying,
      strategy_type: 'credit_spread',
      expiration_date: shortLeg.expirationDate,
      dte: shortLeg.dte,
      estimated_credit: Number(credit.toFixed(2)),
      max_loss: Number(maxLoss.toFixed(2)),
      buying_power_estimate: Number((width * 100).toFixed(2)),
      short_delta: Number(delta.toFixed(4)),
      policy_ok: true,
      policy_notes: [],
      legs,
      order_json: JSON.stringify(order),
      score: candidateScore({
        credit,
        maxLoss: maxLoss / 100,
        deltaDistance: Math.abs(delta - 0.15),
        dteDistance: Math.abs((shortLeg.dte ?? 0) - 7),
      }),
    });
  }
  return candidates;
}

function findClosestStrike(contracts: OptionContract[], targetStrike: number): OptionContract | null {
  let best: OptionContract | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const contract of contracts) {
    const distance = Math.abs(contract.strike - targetStrike);
    if (distance < bestDistance) {
      best = contract;
      bestDistance = distance;
    }
  }
  return best;
}

function approximateDelta(strike: number, underlyingPrice: number): number {
  const distancePct = Math.abs(strike - underlyingPrice) / Math.max(underlyingPrice, 1);
  if (distancePct >= 0.06) return 0.08;
  if (distancePct >= 0.04) return 0.12;
  if (distancePct >= 0.03) return 0.15;
  if (distancePct >= 0.02) return 0.2;
  return 0.3;
}

function spreadWidthFromCandidate(candidate: Candidate): number {
  const strikes = candidate.legs.map((leg) => leg.strike).filter((strike): strike is number => typeof strike === 'number');
  return strikes.length >= 2 ? Math.abs(strikes[0] - strikes[1]) : 0;
}

function applyPolicy(
  candidate: Candidate,
  params: { totalEquity: number; maxRiskPerTradePct: number; maxBuyingPowerUsagePct: number }
): Candidate {
  const notes = [...candidate.policy_notes];
  let policyOk = candidate.policy_ok;
  if (candidate.max_loss != null && params.totalEquity > 0) {
    const riskPct = candidate.max_loss / params.totalEquity;
    if (riskPct > params.maxRiskPerTradePct) {
      notes.push(`Max loss is ${(riskPct * 100).toFixed(2)}% of equity, above policy cap.`);
      policyOk = false;
    }
  }
  if (candidate.buying_power_estimate > 0 && params.totalEquity > 0) {
    const bpPct = candidate.buying_power_estimate / params.totalEquity;
    if (bpPct > params.maxBuyingPowerUsagePct) {
      notes.push(`Buying power estimate is ${(bpPct * 100).toFixed(2)}% of equity, above policy cap.`);
      policyOk = false;
    }
  }
  return {
    ...candidate,
    policy_ok: policyOk,
    policy_notes: notes,
    score: candidate.score - (policyOk ? 0 : 75),
  };
}
