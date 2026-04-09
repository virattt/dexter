import { z } from 'zod';

/**
 * Shared validation helpers for finance tools.
 *
 * These functions perform lightweight, defensive checks on tickers, limits,
 * and dates before calling external APIs. They are intentionally conservative
 * and return clear error messages to help the LLM recover when it constructs
 * bad tool arguments.
 */

const TICKER_REGEX = /^[A-Z0-9.\-]+$/;
const MAX_TICKER_LENGTH = 12;

export function normalizeTicker(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  // Strip everything except digits, letters, dot, and dash; uppercase final value.
  const cleaned = trimmed.replace(/[^A-Za-z0-9.\-]/g, '').toUpperCase();
  return cleaned;
}

export function validateTicker(raw: string, fieldName = 'ticker'): string {
  const normalized = normalizeTicker(raw);
  if (!normalized) {
    throw new Error(`Invalid ${fieldName}: value is empty after trimming.`);
  }
  if (normalized.length > MAX_TICKER_LENGTH) {
    throw new Error(
      `Invalid ${fieldName} '${normalized}': too long. Expected a standard equity ticker symbol.`,
    );
  }
  if (!TICKER_REGEX.test(normalized)) {
    throw new Error(
      `Invalid ${fieldName} '${normalized}': must contain only letters, numbers, '.', or '-'.`,
    );
  }
  return normalized;
}

export function validateLimit(
  limit: number,
  {
    fieldName = 'limit',
    min = 1,
    max = 40,
  }: { fieldName?: string; min?: number; max?: number } = {},
): number {
  if (!Number.isFinite(limit) || Number.isNaN(limit)) {
    throw new Error(`Invalid ${fieldName}: must be a finite number.`);
  }
  if (!Number.isInteger(limit)) {
    throw new Error(`Invalid ${fieldName}: must be an integer.`);
  }
  if (limit < min) {
    throw new Error(`Invalid ${fieldName}: must be >= ${min}.`);
  }
  if (limit > max) {
    throw new Error(`Invalid ${fieldName}: must be <= ${max}.`);
  }
  return limit;
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function validateDate(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!DATE_REGEX.test(trimmed)) {
    throw new Error(
      `Invalid ${fieldName}: expected YYYY-MM-DD format, received '${value}'.`,
    );
  }

  // Basic validity check using Date; this catches impossible dates like 2024-13-40.
  const parsed = new Date(trimmed + 'T00:00:00');
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${fieldName}: '${value}' is not a real calendar date.`);
  }
  return trimmed;
}

export function validateDateRange(start: string, end: string): { start: string; end: string } {
  const startValidated = validateDate(start, 'start_date');
  const endValidated = validateDate(end, 'end_date');

  const startDate = new Date(startValidated + 'T00:00:00');
  const endDate = new Date(endValidated + 'T00:00:00');

  if (startDate > endDate) {
    throw new Error(
      `Invalid date range: start_date (${startValidated}) must be on or before end_date (${endValidated}).`,
    );
  }

  return { start: startValidated, end: endValidated };
}

/**
 * Validate optional report_period* filters used across financial statement tools.
 * Uses zod behind the scenes to keep the validation consistent with tool schemas.
 */
const ReportPeriodFilterSchema = z
  .string()
  .regex(DATE_REGEX, 'must be in YYYY-MM-DD format')
  .optional();

export function validateReportPeriodFilters<
  T extends {
    report_period?: string;
    report_period_gt?: string;
    report_period_gte?: string;
    report_period_lt?: string;
    report_period_lte?: string;
  },
>(input: T): T {
  const parsed = {
    report_period: ReportPeriodFilterSchema.parse(input.report_period),
    report_period_gt: ReportPeriodFilterSchema.parse(input.report_period_gt),
    report_period_gte: ReportPeriodFilterSchema.parse(input.report_period_gte),
    report_period_lt: ReportPeriodFilterSchema.parse(input.report_period_lt),
    report_period_lte: ReportPeriodFilterSchema.parse(input.report_period_lte),
  };
  return { ...input, ...parsed };
}

