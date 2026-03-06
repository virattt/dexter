process.env.FINANCIAL_DATASETS_API_KEY = 'invalid';

async function test() {
  const { callApi } = await import('./src/tools/finance/api.js');
  
  console.log('--- Testing /prices/snapshot/ ---');
  let res = await callApi('/prices/snapshot/', { ticker: 'AAPL' }, { cacheable: false });
  console.log('Result:', JSON.stringify(res.data).substring(0, 150));

  console.log('\n--- Testing /financials/ (for getAllFinancialStatements) ---');
  try {
     res = await callApi('/financials/', { ticker: 'AAPL', period: 'annual' }, { cacheable: false });
     console.log('Result:', JSON.stringify(res.data).substring(0, 150));
  } catch(e) {
     console.error('Failed as expected:', e.message);
  }
}

test();
