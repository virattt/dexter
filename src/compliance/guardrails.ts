import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { dexterPath } from '../utils/paths.js';

export type ComplianceDecision = 'allowed' | 'rewritten' | 'blocked';

export type ComplianceGuardrailResult = {
  decision: ComplianceDecision;
  answer: string;
  reasons: string[];
};

type ApplyComplianceGuardrailsInput = {
  answer: string;
  query?: string;
  channel?: string;
  isHeartbeat?: boolean;
};

const COMPLIANCE_LOG_PATH = dexterPath('compliance', 'decisions.jsonl');
const DISCLAIMER =
  'This is research information, not personalized financial advice. Consider your risk tolerance and consult a licensed financial advisor before making investment decisions.';

const HIGH_RISK_PHRASES = [
  /\bi guarantee\b/i,
  /\bguaranteed returns?\b/i,
  /\brisk[- ]?free\b/i,
  /\bzero risk\b/i,
  /\binsider information\b/i,
  /\bnon[- ]public\b/i,
  /\bpump (it|this)\b/i,
  /\bmarket manipulation\b/i,
];

const ACTIONABLE_ADVICE_PHRASES = [
  /\byou should (buy|sell|short|long)\b/i,
  /\bbuy (this|now|immediately)\b/i,
  /\bsell (this|now|immediately)\b/i,
  /\ball[- ]in\b/i,
  /\bcan't lose\b/i,
];

const FACTUAL_CLAIM_PATTERN = /\b(?:revenue|earnings|eps|p\/e|cash flow|market cap)\b/i;
const CITATION_PATTERN = /https?:\/\/\S+|\[[^\]]+\]\(https?:\/\/[^)]+\)/i;

function normalizeAdviceLanguage(text: string): string {
  return text
    .replace(/\byou should buy\b/gi, 'consider evaluating')
    .replace(/\byou should sell\b/gi, 'consider reviewing')
    .replace(/\bbuy now\b/gi, 'consider researching further before any trade')
    .replace(/\bsell now\b/gi, 'consider reassessing your thesis and risk')
    .replace(/\ball[- ]in\b/gi, 'size positions cautiously')
    .replace(/\bcan't lose\b/gi, 'no outcome is guaranteed');
}

function hasAnyPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function appendDisclaimer(text: string): string {
  if (text.toLowerCase().includes('not personalized financial advice')) {
    return text;
  }
  return `${text.trim()}\n\n${DISCLAIMER}`;
}

function logComplianceDecision(params: {
  decision: ComplianceDecision;
  reasons: string[];
  channel?: string;
  query?: string;
}) {
  try {
    mkdirSync(dirname(COMPLIANCE_LOG_PATH), { recursive: true });
    appendFileSync(
      COMPLIANCE_LOG_PATH,
      `${JSON.stringify({
        type: 'compliance_decision',
        timestamp: new Date().toISOString(),
        decision: params.decision,
        reasons: params.reasons,
        channel: params.channel ?? 'unknown',
        queryPreview: params.query ? params.query.slice(0, 200) : null,
      })}\n`,
    );
  } catch {
    // Never fail runtime on compliance logging errors.
  }
}

export function applyComplianceGuardrails(
  input: ApplyComplianceGuardrailsInput,
): ComplianceGuardrailResult {
  if (input.isHeartbeat) {
    return { decision: 'allowed', answer: input.answer, reasons: [] };
  }

  const reasons: string[] = [];
  const original = input.answer ?? '';
  const trimmed = original.trim();
  if (!trimmed) {
    return { decision: 'allowed', answer: original, reasons };
  }

  const hasHighRisk = hasAnyPattern(trimmed, HIGH_RISK_PHRASES);
  const hasActionableAdvice = hasAnyPattern(trimmed, ACTIONABLE_ADVICE_PHRASES);
  const hasFactualClaim = FACTUAL_CLAIM_PATTERN.test(trimmed);
  const hasCitation = CITATION_PATTERN.test(trimmed);

  if (hasHighRisk) {
    reasons.push('high_risk_financial_language');
    const blockedAnswer =
      'I can help with neutral market research, but I cannot provide or repeat high-risk financial instructions or manipulation-related guidance.';
    logComplianceDecision({
      decision: 'blocked',
      reasons,
      channel: input.channel,
      query: input.query,
    });
    return { decision: 'blocked', answer: blockedAnswer, reasons };
  }

  let rewritten = trimmed;
  if (hasActionableAdvice) {
    reasons.push('actionable_advice_rewritten');
    rewritten = normalizeAdviceLanguage(rewritten);
  }

  if (hasFactualClaim && !hasCitation) {
    reasons.push('factual_claim_without_citation');
    rewritten = `${rewritten}\n\nNote: Some factual claims above may require source verification.`;
  }

  if (hasActionableAdvice || (hasFactualClaim && !hasCitation)) {
    rewritten = appendDisclaimer(rewritten);
    logComplianceDecision({
      decision: 'rewritten',
      reasons,
      channel: input.channel,
      query: input.query,
    });
    return { decision: 'rewritten', answer: rewritten, reasons };
  }

  logComplianceDecision({
    decision: 'allowed',
    reasons,
    channel: input.channel,
    query: input.query,
  });
  return { decision: 'allowed', answer: original, reasons };
}
