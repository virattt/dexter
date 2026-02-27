import { getAlphaVantagePriceSnapshot, getAlphaVantageOverview } from './src/tools/finance/alpha_vantage.js';
import { getYahooPriceSnapshot } from './src/tools/finance/yahoo.js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

async function runDirectVerification() {
    const log: string[] = [];
    log.push("================================================");
    log.push("   DEXTER DIRECT MODE (Bypassing LLM Router)    ");
    log.push("================================================");

    // 1. Alpha Vantage Price (Preferred)
    log.push("🔍 Fetching Price for TATA MOTORS (TATAMOTORS.BSE) via Alpha Vantage...");
    try {
        const avPrice = await getAlphaVantagePriceSnapshot.invoke({ ticker: 'TATAMOTORS.BSE' });
        if (typeof avPrice === 'object') log.push("RESULT: " + JSON.stringify(avPrice));
        else log.push("RESULT: " + avPrice);
    } catch (e: any) {
        log.push("❌ FAIL (Alpha Vantage): " + (e.message || String(e)));
    }

    // 2. Alpha Vantage Overview
    log.push("\n🔍 Fetching Fundamentals for TATA MOTORS via Alpha Vantage...");
    try {
        const avFund = await getAlphaVantageOverview.invoke({ ticker: 'TATAMOTORS.BSE' });
        if (typeof avFund === 'object') log.push("RESULT: " + JSON.stringify(avFund));
        else log.push("RESULT: " + avFund);
    } catch (e: any) {
        log.push("❌ FAIL (Alpha Vantage): " + (e.message || String(e)));
    }

    // 3. Fallback Check
    log.push("\n🔍 Checking Yahoo Finance (Fallback) for HDFC BANK...");
    try {
        const yPrice = await getYahooPriceSnapshot.invoke({ ticker: 'HDFCBANK.NS' });
        if (typeof yPrice === 'object') log.push("Yahoo Output: " + JSON.stringify(yPrice));
        else log.push("Yahoo Output: " + yPrice);
    } catch (e: any) {
        log.push("Yahoo Status: " + (e.message || String(e)));
    }

    log.push("\n================================================");
    fs.writeFileSync('direct-output.txt', log.join('\n'));
}

runDirectVerification();
