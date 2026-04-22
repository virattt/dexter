#!/usr/bin/env node

// Test script for Indian market tools in Dexter
import { getIndianMarketStatus, getIndianStockPrice, getIndianIncomeStatement, getIndianBalanceSheet, getIndianCashFlowStatement, getIndianKeyRatios } from './src/tools/finance/index.ts';

async function testIndianMarkets() {
  console.log('Testing Indian Market Tools...\n');

  // Test market status
  console.log('1. Testing Indian Market Status:');
  try {
    const result = await getIndianMarketStatus.func({});
    const parsed = JSON.parse(result);
    console.log('Market Status:', parsed.data);
  } catch (error) {
    console.log('Error:', error.message);
  }

  console.log('\n2. Testing Indian Stock Price (RELIANCE.NS):');
  try {
    const result = await getIndianStockPrice.func({ ticker: 'RELIANCE.NS' });
    const parsed = JSON.parse(result);
    console.log('Stock Price:', parsed.data);
  } catch (error) {
    console.log('Error:', error.message);
  }

  console.log('\n3. Testing Indian Income Statement (RELIANCE.NS):');
  try {
    const result = await getIndianIncomeStatement.func({ ticker: 'RELIANCE.NS', period: 'annual' });
    const parsed = JSON.parse(result);
    console.log('Income Statement:', parsed.data);
  } catch (error) {
    console.log('Error:', error.message);
  }

  console.log('\n4. Testing Indian Key Ratios (TCS.NS):');
  try {
    const result = await getIndianKeyRatios.func({ ticker: 'TCS.NS' });
    const parsed = JSON.parse(result);
    console.log('Key Ratios:', parsed.data);
  } catch (error) {
    console.log('Error:', error.message);
  }
}

testIndianMarkets().catch(console.error);
