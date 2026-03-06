import { callApi } from './src/tools/finance/api.js';

// Override the API key to force a 401 error
delete process.env.FINANCIAL_DATASETS_API_KEY;
process.env.FINANCIAL_DATASETS_API_KEY = '';



async function run() {
  console.log('Testing US Market Fallback (Expected: 401 from API, transparent fallback to Yahoo)\n');

  try {
    console.log('--- 1. Testing Financial Metrics Snapshot (Quotes, Market Cap, Ratios)...');
    const quote = await callApi('/financial-metrics/snapshot/', { ticker: 'AAPL' }, { cacheable: false });
    console.log(`Success! Fetched ${quote.data?.snapshot?.length ?? quote.data?.data?.length ?? 0} items.`);
    console.log(JSON.stringify(quote.data, null, 2).slice(0, 300) + '...\n');

    console.log('--- 2. Testing Historical Prices...');
    const prices = await callApi('/prices/', { ticker: 'AAPL', start_date: '2024-01-01', end_date: '2024-01-10' }, { cacheable: false });
    console.log(`Success! Fetched ${prices.data?.prices?.length ?? prices.data?.data?.length ?? 0} items.`);
    console.log(JSON.stringify(prices.data, null, 2).slice(0, 300) + '...\n');

    console.log('--- 3. Testing Income Statements (DCF Data)...');
    const income = await callApi('/financials/income-statements/', { ticker: 'MSFT', period: 'annual' }, { cacheable: false });
    console.log(`Success! Fetched ${income.data?.income_statements?.length ?? income.data?.data?.length ?? 0} items.`);
    console.log(JSON.stringify(income.data, null, 2).slice(0, 300) + '...\n');

    console.log('All fallback modules triggered successfully!');
  } catch (err) {
    console.error(`\nFAILED: Fallback did not catch the error or threw its own error:`);
    console.error(err);
    process.exit(1);
  }
}

run();
