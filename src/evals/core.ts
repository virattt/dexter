/**
 * Shared eval helpers used by the eval runner and unit tests.
 */

// Types
export interface EvalExample {
  inputs: { question: string };
  outputs: { answer: string };
}

export interface ReliabilityIssue {
  code: string;
  message: string;
}

export interface ReliabilityCheckResult {
  passed: boolean;
  issues: ReliabilityIssue[];
}

/**
 * Parse CSV content into eval examples.
 * Handles quoted commas, escaped quotes, and multi-line fields.
 */
export function parseCSV(csvContent: string): EvalExample[] {
  const examples: EvalExample[] = [];
  const lines = csvContent.split('\n');

  let i = 1; // Skip header row

  while (i < lines.length) {
    const result = parseRow(lines, i);
    if (result) {
      const { row, nextIndex } = result;
      if (row.length >= 2 && row[0].trim()) {
        examples.push({
          inputs: { question: row[0] },
          outputs: { answer: row[1] },
        });
      }
      i = nextIndex;
    } else {
      i++;
    }
  }

  return examples;
}

/**
 * Parse a single CSV row from the given line index.
 * Returns null for blank lines.
 */
export function parseRow(
  lines: string[],
  startIndex: number
): { row: string[]; nextIndex: number } | null {
  if (startIndex >= lines.length || !lines[startIndex].trim()) {
    return null;
  }

  const fields: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let lineIndex = startIndex;
  let charIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];

    while (charIndex < line.length) {
      const char = line[charIndex];
      const nextChar = line[charIndex + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          // Escaped quote
          currentField += '"';
          charIndex += 2;
        } else if (char === '"') {
          // End of quoted field
          inQuotes = false;
          charIndex++;
        } else {
          currentField += char;
          charIndex++;
        }
      } else if (char === ',') {
        // End of field
        fields.push(currentField);
        currentField = '';
        charIndex++;
      } else if (char === '"') {
        // Start of quoted field
        inQuotes = true;
        charIndex++;
      } else {
        currentField += char;
        charIndex++;
      }
    }

    if (inQuotes) {
      // Continue to next line (multi-line field)
      currentField += '\n';
      lineIndex++;
      charIndex = 0;
    } else {
      // Row complete
      fields.push(currentField);
      return { row: fields, nextIndex: lineIndex + 1 };
    }
  }

  // Handle case where file ends while in quotes
  if (currentField) {
    fields.push(currentField);
  }
  return { row: fields, nextIndex: lineIndex };
}

/**
 * Deterministic sanity checks for generated answers.
 * These checks are strict on clear failure modes (errors, internal payload leaks)
 * and are used as a reliability gate in eval scoring.
 */
export function runReliabilityChecks(answer: string): ReliabilityCheckResult {
  const issues: ReliabilityIssue[] = [];
  const trimmed = answer.trim();

  if (!trimmed) {
    issues.push({
      code: 'empty_answer',
      message: 'Generated answer is empty.',
    });
    return { passed: false, issues };
  }

  if (trimmed.length > 20_000) {
    issues.push({
      code: 'oversized_answer',
      message: 'Generated answer exceeds 20,000 characters.',
    });
  }

  const internalLeakPatterns: Array<{ pattern: RegExp; code: string; message: string }> = [
    {
      pattern: /\bsourceUrls?\b/i,
      code: 'internal_sourceurls_leak',
      message: 'Answer leaked internal `sourceUrls` payload field.',
    },
    {
      pattern: /\btool_calls?\b/i,
      code: 'internal_tool_calls_leak',
      message: 'Answer leaked internal tool call payload.',
    },
    {
      pattern: /\bfinancialdatasets\.ai\b/i,
      code: 'internal_api_url_leak',
      message: 'Answer leaked raw Financial Datasets API URL.',
    },
  ];

  for (const { pattern, code, message } of internalLeakPatterns) {
    if (pattern.test(trimmed)) {
      issues.push({ code, message });
    }
  }

  const failurePatterns: Array<{ pattern: RegExp; code: string; message: string }> = [
    {
      pattern: /\bno tools available\b/i,
      code: 'tool_unavailable',
      message: 'Answer contains tool availability failure.',
    },
    {
      pattern: /\bapi request failed\b/i,
      code: 'api_request_failed',
      message: 'Answer contains upstream API failure text.',
    },
    {
      pattern: /\bfailed to (parse|select|fetch)\b/i,
      code: 'tool_parse_or_fetch_failure',
      message: 'Answer contains tool parsing/fetch failure text.',
    },
  ];

  for (const { pattern, code, message } of failurePatterns) {
    if (pattern.test(trimmed)) {
      issues.push({ code, message });
    }
  }

  const looksLikeRawToolPayload =
    (/^\s*\{[\s\S]*\}\s*$/.test(trimmed) || /^\s*\[[\s\S]*\]\s*$/.test(trimmed)) &&
    (/"data"\s*:/.test(trimmed) || /"sourceUrls"\s*:/.test(trimmed));

  if (looksLikeRawToolPayload) {
    issues.push({
      code: 'raw_payload_output',
      message: 'Answer appears to be raw tool JSON instead of a user-facing response.',
    });
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

export function formatReliabilityIssues(issues: ReliabilityIssue[]): string {
  return issues.map((i) => i.message).join(' ');
}

