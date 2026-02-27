import { getAlphaVantagePriceSnapshot, getAlphaVantageOverview } from './src/tools/finance/alpha_vantage.js';
import dotenv from 'dotenv';
dotenv.config();

async function testAV() {
    console.log("Testing Alpha Vantage Integration for Indian Stocks...");

    console.log("\n1. Testing Price Snapshot for RELIANCE.BSE");
    try {
        const price = await getAlphaVantagePriceSnapshot.invoke({ ticker: 'RELIANCE.BSE' });
        console.log(price);
    } catch (e) {
        console.error("Price check failed:", e);
    }

    console.log("\n2. Testing Fundamentals (Overview) for TATAMOTORS.BSE");
    try {
        const fund = await getAlphaVantageOverview.invoke({ ticker: 'TATAMOTORS.BSE' });
        console.log(fund);
    } catch (e) {
        console.error("Fundamentals check failed:", e);
    }
}

testAV();
