import { getAlphaVantagePriceSnapshot } from './src/tools/finance/alpha_vantage.js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

async function testDebug() {
    const log = [];
    log.push("--- DEBUG START ---");

    // 1. Control Test (US Stock)
    log.push("\n1. Testing IBM (US Control)");
    try {
        const res = await getAlphaVantagePriceSnapshot.invoke({ ticker: 'IBM' });
        if (typeof res === 'object') {
            log.push("IBM Result: " + JSON.stringify(res));
        } else {
            log.push("IBM Result: " + res);
        }
    } catch (e) {
        log.push("IBM Failed: " + e);
    }

    // 2. Indian Stock (BSE)
    log.push("\n2. Testing RELIANCE.BSE");
    try {
        const res = await getAlphaVantagePriceSnapshot.invoke({ ticker: 'RELIANCE.BSE' });
        if (typeof res === 'object') {
            log.push("RELIANCE.BSE Result: " + JSON.stringify(res));
        } else {
            log.push("RELIANCE.BSE Result: " + res);
        }
    } catch (e) {
        log.push("RELIANCE.BSE Failed: " + e);
    }

    // 3. Indian Stock (NSE)
    log.push("\n3. Testing RELIANCE.NSE");
    try {
        const res = await getAlphaVantagePriceSnapshot.invoke({ ticker: 'RELIANCE.NSE' });
        if (typeof res === 'object') {
            log.push("RELIANCE.NSE Result: " + JSON.stringify(res));
        } else {
            log.push("RELIANCE.NSE Result: " + res);
        }
    } catch (e) {
        log.push("RELIANCE.NSE Failed: " + e);
    }

    log.push("--- DEBUG END ---");
    fs.writeFileSync('debug-output.txt', log.join('\n'));
}

testDebug();
