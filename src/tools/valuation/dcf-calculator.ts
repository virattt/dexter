import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';

const DEFAULT_TERMINAL_GROWTH_RATES = [0.02, 0.025, 0.03];

export interface DcfInput {
  baseFcf: number;
  growthRates?: number[];
  projectedFcfs?: number[];
  discountRate: number;
  terminalGrowthRate: number;
  netDebt?: number;
  sharesOutstanding: number;
  terminalGrowthRates?: number[];
  discountRates?: number[];
  units?: 'raw' | 'millions' | 'billions';
}

export interface DcfProjection {
  year: number;
  growthRate: number | null;
  fcf: number;
  discountFactor: number;
  presentValue: number;
}

export interface DcfSensitivityCell {
  discountRate: number;
  terminalGrowthRate: number;
  valuePerShare: number;
  enterpriseValue: number;
  pvTerminalValue: number;
}

export interface DcfResult {
  units: 'raw' | 'millions' | 'billions';
  formulas: {
    terminalValue: string;
    presentValue: string;
    enterpriseValue: string;
    equityValue: string;
    valuePerShare: string;
  };
  inputs: Required<Pick<DcfInput, 'baseFcf' | 'discountRate' | 'terminalGrowthRate' | 'netDebt' | 'sharesOutstanding' | 'units'>> & {
    growthRates: number[];
  };
  projections: DcfProjection[];
  totalPvFcf: number;
  terminalValue: number;
  pvTerminalValue: number;
  enterpriseValue: number;
  equityValue: number;
  valuePerShare: number;
  terminalValueShareOfEnterpriseValue: number;
  sensitivity: DcfSensitivityCell[][];
  warnings: string[];
}

function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function assertFiniteNumber(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number.`);
  }
}

function normalizeRates(rates: number[] | undefined, fallback: number[]): number[] {
  const source = rates?.length ? rates : fallback;
  return source.map((rate) => round(rate, 6));
}

function projectFcfs(input: DcfInput): { projections: DcfProjection[]; growthRates: number[] } {
  if (input.projectedFcfs?.length) {
    const growthRates = input.projectedFcfs.map((fcf, index) => {
      const previous = index === 0 ? input.baseFcf : input.projectedFcfs![index - 1];
      return previous === 0 ? 0 : fcf / previous - 1;
    });
    return {
      growthRates,
      projections: input.projectedFcfs.map((fcf, index) => {
        const year = index + 1;
        const discountFactor = (1 + input.discountRate) ** year;
        return {
          year,
          growthRate: growthRates[index],
          fcf,
          discountFactor,
          presentValue: fcf / discountFactor,
        };
      }),
    };
  }

  if (!input.growthRates?.length) {
    throw new Error('Provide either growthRates or projectedFcfs.');
  }

  const projections: DcfProjection[] = [];
  let fcf = input.baseFcf;
  for (let index = 0; index < input.growthRates.length; index++) {
    const year = index + 1;
    const growthRate = input.growthRates[index];
    fcf *= 1 + growthRate;
    const discountFactor = (1 + input.discountRate) ** year;
    projections.push({
      year,
      growthRate,
      fcf,
      discountFactor,
      presentValue: fcf / discountFactor,
    });
  }

  return { projections, growthRates: input.growthRates };
}

function calculateSingleCase(
  projections: DcfProjection[],
  discountRate: number,
  terminalGrowthRate: number,
  netDebt: number,
  sharesOutstanding: number,
): Omit<DcfResult, 'units' | 'formulas' | 'inputs' | 'sensitivity' | 'warnings'> {
  if (discountRate <= terminalGrowthRate) {
    throw new Error('discountRate must be greater than terminalGrowthRate.');
  }

  const totalPvFcf = projections.reduce((sum, projection) => sum + projection.presentValue, 0);
  const finalFcf = projections[projections.length - 1]?.fcf;
  if (finalFcf === undefined) {
    throw new Error('At least one projected FCF is required.');
  }

  const terminalValue = (finalFcf * (1 + terminalGrowthRate)) / (discountRate - terminalGrowthRate);
  const pvTerminalValue = terminalValue / ((1 + discountRate) ** projections.length);
  const enterpriseValue = totalPvFcf + pvTerminalValue;
  const equityValue = enterpriseValue - netDebt;
  const valuePerShare = equityValue / sharesOutstanding;

  return {
    projections,
    totalPvFcf,
    terminalValue,
    pvTerminalValue,
    enterpriseValue,
    equityValue,
    valuePerShare,
    terminalValueShareOfEnterpriseValue: enterpriseValue === 0 ? 0 : pvTerminalValue / enterpriseValue,
  };
}

function buildSensitivity(
  input: DcfInput,
  baseGrowthRates: number[],
  discountRates: number[],
  terminalGrowthRates: number[],
  netDebt: number,
): DcfSensitivityCell[][] {
  return discountRates.map((discountRate) => {
    return terminalGrowthRates.map((terminalGrowthRate) => {
      const { projections } = projectFcfs({
        ...input,
        growthRates: baseGrowthRates,
        projectedFcfs: undefined,
        discountRate,
        terminalGrowthRate,
      });
      const result = calculateSingleCase(
        projections,
        discountRate,
        terminalGrowthRate,
        netDebt,
        input.sharesOutstanding,
      );
      return {
        discountRate,
        terminalGrowthRate,
        valuePerShare: result.valuePerShare,
        enterpriseValue: result.enterpriseValue,
        pvTerminalValue: result.pvTerminalValue,
      };
    });
  });
}

export function calculateDcf(input: DcfInput): DcfResult {
  assertFiniteNumber('baseFcf', input.baseFcf);
  assertFiniteNumber('discountRate', input.discountRate);
  assertFiniteNumber('terminalGrowthRate', input.terminalGrowthRate);
  assertFiniteNumber('sharesOutstanding', input.sharesOutstanding);

  if (input.sharesOutstanding <= 0) {
    throw new Error('sharesOutstanding must be greater than zero.');
  }
  if (input.discountRate <= input.terminalGrowthRate) {
    throw new Error('discountRate must be greater than terminalGrowthRate.');
  }

  const netDebt = input.netDebt ?? 0;
  assertFiniteNumber('netDebt', netDebt);

  const units = input.units ?? 'billions';
  const { projections, growthRates } = projectFcfs(input);
  const result = calculateSingleCase(
    projections,
    input.discountRate,
    input.terminalGrowthRate,
    netDebt,
    input.sharesOutstanding,
  );

  const warnings: string[] = [];
  if (result.terminalValueShareOfEnterpriseValue > 0.85) {
    warnings.push(
      `PV of terminal value is ${round(result.terminalValueShareOfEnterpriseValue * 100, 1)}% of enterprise value; DCF is highly terminal-value sensitive.`,
    );
  }
  if (input.terminalGrowthRate >= input.discountRate - 0.01) {
    warnings.push('Terminal growth rate is within 1 percentage point of discount rate; valuation may be unstable.');
  }

  const discountRates = normalizeRates(
    input.discountRates,
    [input.discountRate - 0.01, input.discountRate, input.discountRate + 0.01].filter((rate) => rate > input.terminalGrowthRate),
  );
  const terminalGrowthRates = normalizeRates(input.terminalGrowthRates, DEFAULT_TERMINAL_GROWTH_RATES);

  const sensitivity = buildSensitivity(input, growthRates, discountRates, terminalGrowthRates, netDebt);

  return {
    units,
    formulas: {
      terminalValue: 'terminalValue = finalYearFcf * (1 + terminalGrowthRate) / (discountRate - terminalGrowthRate)',
      presentValue: 'presentValue = futureCashFlow / (1 + discountRate) ^ year',
      enterpriseValue: 'enterpriseValue = sum(presentValueOfProjectedFcfs) + presentValueOfTerminalValue',
      equityValue: 'equityValue = enterpriseValue - netDebt',
      valuePerShare: 'valuePerShare = equityValue / sharesOutstanding',
    },
    inputs: {
      baseFcf: input.baseFcf,
      growthRates,
      discountRate: input.discountRate,
      terminalGrowthRate: input.terminalGrowthRate,
      netDebt,
      sharesOutstanding: input.sharesOutstanding,
      units,
    },
    projections: result.projections.map((projection) => ({
      year: projection.year,
      growthRate: projection.growthRate === null ? null : round(projection.growthRate, 6),
      fcf: round(projection.fcf, 4),
      discountFactor: round(projection.discountFactor, 6),
      presentValue: round(projection.presentValue, 4),
    })),
    totalPvFcf: round(result.totalPvFcf, 4),
    terminalValue: round(result.terminalValue, 4),
    pvTerminalValue: round(result.pvTerminalValue, 4),
    enterpriseValue: round(result.enterpriseValue, 4),
    equityValue: round(result.equityValue, 4),
    valuePerShare: round(result.valuePerShare, 4),
    terminalValueShareOfEnterpriseValue: round(result.terminalValueShareOfEnterpriseValue, 6),
    sensitivity: sensitivity.map((row) =>
      row.map((cell) => ({
        discountRate: round(cell.discountRate, 6),
        terminalGrowthRate: round(cell.terminalGrowthRate, 6),
        valuePerShare: round(cell.valuePerShare, 4),
        enterpriseValue: round(cell.enterpriseValue, 4),
        pvTerminalValue: round(cell.pvTerminalValue, 4),
      })),
    ),
    warnings,
  };
}

const inputSchema = z.object({
  baseFcf: z
    .number()
    .describe('Current/base free cash flow or owner earnings, using the selected units. Example: 83.8 for $83.8B.'),
  growthRates: z
    .array(z.number())
    .optional()
    .describe('Projected annual growth rates as decimals. Example: [0.05, 0.045, 0.04, 0.035, 0.03].'),
  projectedFcfs: z
    .array(z.number())
    .optional()
    .describe('Optional explicit projected FCFs for each forecast year, using the selected units. Overrides growthRates if provided.'),
  discountRate: z.number().describe('Discount rate/WACC as a decimal. Example: 0.10 for 10%.'),
  terminalGrowthRate: z.number().describe('Terminal growth rate as a decimal. Example: 0.025 for 2.5%.'),
  netDebt: z
    .number()
    .optional()
    .describe('Debt minus cash/investments, using the selected units. Use a negative number for net cash.'),
  sharesOutstanding: z
    .number()
    .describe('Shares outstanding in the same scale as monetary units. If units are billions, use shares in billions.'),
  discountRates: z
    .array(z.number())
    .optional()
    .describe('Optional discount rates for sensitivity rows. Defaults to base ±1 percentage point.'),
  terminalGrowthRates: z
    .array(z.number())
    .optional()
    .describe('Optional terminal growth rates for sensitivity columns. Defaults to 2.0%, 2.5%, and 3.0%.'),
  units: z.enum(['raw', 'millions', 'billions']).default('billions'),
});

export const DCF_CALCULATOR_DESCRIPTION = `
Deterministic discounted cash flow calculator.

Use this for every DCF valuation, fair value estimate, price target derived from projected cash flows, and sensitivity table. It computes projected FCFs, discounted FCFs, Gordon Growth terminal value, present value of terminal value, enterprise value, equity value, value per share, and a sensitivity matrix.

Important:
- Do not calculate terminal value or value per share manually when this tool can do it.
- Monetary inputs and shares must use compatible scales. Example: for $83.8B FCF and 14.95B shares, set units="billions", baseFcf=83.8, sharesOutstanding=14.95.
- Use netDebt = debt minus cash/investments. For net cash, pass a negative number.
`.trim();

export const dcfCalculatorTool = new DynamicStructuredTool({
  name: 'dcf_calculator',
  description: DCF_CALCULATOR_DESCRIPTION,
  schema: inputSchema,
  func: async (input) => {
    try {
      return formatToolResult(calculateDcf(input));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return formatToolResult({ error: message });
    }
  },
});
