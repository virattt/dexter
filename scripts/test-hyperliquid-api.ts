#!/usr/bin/env bun
/**
 * Quick test of Hyperliquid Info API (no agent).
 * Run: bun run scripts/test-hyperliquid-api.ts
 */
import {
  getPerpDexs,
  getHip3DexName,
  getMetaAndAssetCtxs,
  getAllMids,
} from '../src/tools/hyperliquid/hyperliquid-api.js';

async function main() {
  console.log('1. Perp dexes:');
  const dexes = await getPerpDexs();
  console.log(JSON.stringify(dexes, null, 2));

  console.log('\n2. HIP-3 dex name:');
  const hip3 = await getHip3DexName();
  console.log(hip3 ?? '(none found)');

  if (hip3) {
    console.log('\n3. metaAndAssetCtxs (first 3 assets):');
    const [meta, ctxs] = await getMetaAndAssetCtxs(hip3);
    const sample = meta.universe.slice(0, 3).map((a, i) => ({
      name: a.name,
      dayNtlVlm: ctxs[i]?.dayNtlVlm,
      markPx: ctxs[i]?.markPx,
    }));
    console.log(JSON.stringify(sample, null, 2));

    console.log('\n4. allMids (first 5 entries):');
    const mids = await getAllMids(hip3);
    const entries = Object.entries(mids).slice(0, 5);
    console.log(JSON.stringify(Object.fromEntries(entries), null, 2));
  }

  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
