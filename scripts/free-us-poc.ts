#!/usr/bin/env node
import { buildFreeUsPocReport } from '../src/tools/finance/free-us-poc.js';

async function main() {
  const tickers = process.argv.slice(2).map((value) => value.trim().toUpperCase()).filter(Boolean);
  const targets = tickers.length > 0 ? tickers : ['AAPL', 'TSLA'];

  const reports = [];
  for (const ticker of targets) {
    const report = await buildFreeUsPocReport(ticker);
    reports.push(report);
  }

  process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
