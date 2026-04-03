/**
 * TSE（東証）公開Excelから上場銘柄マスタを取得するプロバイダー。
 * URL: https://www.jpx.co.jp/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_j.xls
 * キャッシュ: .kabuto/cache/tse-master.json（TTL: 24時間）
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CompanyInfo, CompanyMasterProvider } from './types.js';

const CACHE_DIR = '.kabuto/cache';
const CACHE_FILE = join(CACHE_DIR, 'tse-master.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24時間
const TSE_EXCEL_URL =
  'https://www.jpx.co.jp/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_j.xls';

interface CacheEntry {
  updatedAt: number;
  companies: CompanyInfo[];
}

export class TseMasterProvider implements CompanyMasterProvider {
  /** 市場区分文字列を正規化 */
  parseMarket(marketName: string): CompanyInfo['market'] {
    if (marketName.includes('プライム')) return 'Prime';
    if (marketName.includes('スタンダード')) return 'Standard';
    if (marketName.includes('グロース')) return 'Growth';
    return 'Other';
  }

  private readCache(): CompanyInfo[] | null {
    if (!existsSync(CACHE_FILE)) return null;
    try {
      const raw = readFileSync(CACHE_FILE, 'utf-8');
      const entry = JSON.parse(raw) as CacheEntry;
      if (Date.now() - entry.updatedAt > CACHE_TTL_MS) return null;
      return entry.companies;
    } catch {
      return null;
    }
  }

  private writeCache(companies: CompanyInfo[]): void {
    mkdirSync(CACHE_DIR, { recursive: true });
    const entry: CacheEntry = { updatedAt: Date.now(), companies };
    writeFileSync(CACHE_FILE, JSON.stringify(entry));
  }

  async fetchAll(): Promise<{ companies: CompanyInfo[]; source: 'jquants' | 'tse-csv' }> {
    const cached = this.readCache();
    if (cached) return { companies: cached, source: 'tse-csv' };

    const response = await fetch(TSE_EXCEL_URL);
    if (!response.ok) {
      throw new Error(`[TSE Master] fetch failed: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Dynamic import to avoid loading xlsx at startup
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]!]!;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    const companies: CompanyInfo[] = rows
      .map((row) => {
        // Excelのカラム名は「コード」「銘柄名」「市場・商品区分」
        const rawCode = String(row['コード'] ?? row['code'] ?? '').trim();
        const name = String(row['銘柄名'] ?? row['name'] ?? '').trim();
        const marketRaw = String(row['市場・商品区分'] ?? row['market'] ?? '').trim();
        if (!rawCode || !name) return null;
        const code = rawCode.padStart(4, '0').slice(0, 4);
        return { code, name, market: this.parseMarket(marketRaw) };
      })
      .filter((c): c is CompanyInfo => c !== null);

    this.writeCache(companies);
    return { companies, source: 'tse-csv' };
  }
}
