import { getYahooPriceSnapshot, getYahooFundamentals, getYahooNews } from './src/tools/finance/yahoo.js';

async function testYahoo() {
    console.log("Testing Yahoo Finance Integration for Indian Stocks...");

    console.log("\n1. Testing Price Snapshot for RELIANCE.NS");
    try {
        const price = await getYahooPriceSnapshot.invoke({ ticker: 'RELIANCE.NS' });
        console.log(price);
    } catch (e) {
        console.error("Price check failed:", e);
    }

    console.log("\n2. Testing Fundamentals for TATAMOTORS.NS");
    try {
        const fund = await getYahooFundamentals.invoke({ ticker: 'TATAMOTORS.NS' });
        // truncating output for readability
        const parsed = JSON.parse(fund);
        console.log("Valuation (partial):", parsed.data.valuation ? "Found" : "Missing");
        console.log("Financials (partial):", parsed.data.financials ? "Found" : "Missing");
    } catch (e) {
        console.error("Fundamentals check failed:", e);
    }

    console.log("\n3. Testing News for INFY.NS");
    try {
        const news = await getYahooNews.invoke({ ticker: 'INFY.NS' });
        console.log(news);
    } catch (e) {
        console.error("News check failed:", e);
    }
}

testYahoo();
