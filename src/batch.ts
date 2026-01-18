#!/usr/bin/env bun
/**
 * Batch mode entry point for Dexter.
 *
 * Usage:
 *   bun batch tickers.txt
 *   bun batch tickers.txt --template "Analyze {TICKER} growth"
 *   bun batch tickers.txt --output ./research --model gpt-5.2
 */
import { config } from 'dotenv';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, join } from 'path';

import { runHeadless } from './batch/headless-runner.js';
import { DEFAULT_TEMPLATE, type BatchResult } from './batch/types.js';
import { getSetting } from './utils/config.js';
import { DEFAULT_MODEL } from './model/llm.js';

/**
 * Generate a timestamped run ID for the output folder.
 * Format: YYYY-MM-DD_HH-MM-SS
 */
function generateRunId(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

// Load environment variables
config({ quiet: true });

interface Args {
  inputFile: string;
  outputDir: string;
  template: string;
  model: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Dexter Batch Mode - Run financial research on multiple tickers

Usage:
  bun batch <tickers.txt> [options]

Options:
  --template <template>  Query template (use {TICKER} as placeholder)
                         Default: "${DEFAULT_TEMPLATE}"
  --output <dir>         Base output directory (default: ./outputs)
                         Each run creates a timestamped subfolder
  --model <model>        Model to use (default: saved model or gpt-5.2)
  -h, --help             Show this help

Output:
  Each run creates: outputs/YYYY-MM-DD_HH-MM-SS/
    - Individual files: AAPL.json, GOOGL.json, etc.
    - Combined file: _combined.json (all results in one file)

Examples:
  bun batch tickers.txt
  bun batch portfolio.txt --output ./research
  bun batch tickers.txt --template "Analyze {TICKER} for dividend investing"
`);
    process.exit(0);
  }

  const inputFile = args[0];
  let outputDir = './outputs';
  let template = DEFAULT_TEMPLATE;
  let model = getSetting('modelId', DEFAULT_MODEL) as string;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) {
      outputDir = args[++i];
    } else if (args[i] === '--template' && args[i + 1]) {
      template = args[++i];
    } else if (args[i] === '--model' && args[i + 1]) {
      model = args[++i];
    }
  }

  return { inputFile, outputDir, template, model };
}

function readTickers(filePath: string): string[] {
  if (!existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  const content = readFileSync(filePath, 'utf-8');
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#')); // Filter empty lines and comments
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

async function main() {
  const { inputFile, outputDir: baseOutputDir, template, model } = parseArgs();

  const tickers = readTickers(inputFile);

  if (tickers.length === 0) {
    console.error('Error: No tickers found in input file');
    process.exit(1);
  }

  // Create timestamped output folder
  const runId = generateRunId();
  const outputDir = join(baseOutputDir, runId);

  console.log(`\nDexter Batch Mode`);
  console.log(`=================`);
  console.log(`Input:    ${inputFile} (${tickers.length} tickers)`);
  console.log(`Output:   ${outputDir}/`);
  console.log(`Model:    ${model}`);
  console.log(`Template: ${template.substring(0, 50)}${template.length > 50 ? '...' : ''}`);
  console.log('');

  // Create output directory
  mkdirSync(outputDir, { recursive: true });

  const runStats: { ticker: string; success: boolean; duration: number; error?: string }[] = [];
  const batchResults: BatchResult[] = [];
  const startTime = Date.now();

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    const query = template.replace(/\{TICKER\}/g, ticker);
    const progress = `[${i + 1}/${tickers.length}]`;

    process.stdout.write(`${progress} ${ticker}... `);

    try {
      const result = await runHeadless({ ticker, query, model });

      // Write individual JSON output
      const outputPath = join(outputDir, `${ticker}.json`);
      writeFileSync(outputPath, JSON.stringify(result, null, 2));

      // Collect for combined output
      batchResults.push(result);

      console.log(`done (${formatDuration(result.metadata.durationMs)})`);
      runStats.push({ ticker, success: true, duration: result.metadata.durationMs });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`failed - ${errorMsg}`);
      runStats.push({ ticker, success: false, duration: 0, error: errorMsg });
    }
  }

  // Write combined JSON with all results
  const totalTime = Date.now() - startTime;
  const combined = {
    runId,
    generatedAt: new Date().toISOString(),
    inputFile: basename(inputFile),
    model,
    template,
    tickerCount: batchResults.length,
    tickers: batchResults.map(r => r.ticker),
    totalDurationMs: totalTime,
    results: batchResults,
  };
  writeFileSync(join(outputDir, '_combined.json'), JSON.stringify(combined, null, 2));

  // Print summary
  const successCount = runStats.filter(r => r.success).length;
  const failCount = runStats.filter(r => !r.success).length;

  console.log('');
  console.log('Summary');
  console.log('-------');
  console.log(`Completed: ${successCount}/${tickers.length} tickers`);
  if (failCount > 0) {
    console.log(`Failed:    ${failCount} tickers`);
    for (const r of runStats.filter(r => !r.success)) {
      console.log(`  - ${r.ticker}: ${r.error}`);
    }
  }
  console.log(`Total time: ${formatDuration(totalTime)}`);
  console.log(`Output: ${outputDir}/`);
  console.log(`Combined: ${outputDir}/_combined.json`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
