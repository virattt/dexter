/**
 * 銘柄マスタプロバイダー抽象層。
 * FINANCE_PROVIDER 環境変数で切替:
 *   auto    - J-Quantsを試して失敗/キーなしならTSE CSVへフォールバック（デフォルト）
 *   jquants - J-Quants API v2 /equities/master のみ
 *   yahoo   - TSE公開CSV（yahoo は銘柄一覧を提供しないためTSEを使う）
 */
import { jquantsApi } from '../jquants-api.js';
import { TseMasterProvider } from './tse-master.js';
import type { CompanyInfo } from './types.js';

export interface FetchCompanyMasterResult {
  companies: CompanyInfo[];
  source: 'jquants' | 'tse-csv';
}

const MARKET_NAME_MAP: Record<string, CompanyInfo['market']> = {
  プライム: 'Prime',
  スタンダード: 'Standard',
  グロース: 'Growth',
};

function parseJQuantsMarket(mktNm: string): CompanyInfo['market'] {
  for (const [key, value] of Object.entries(MARKET_NAME_MAP)) {
    if (mktNm.includes(key)) return value;
  }
  return 'Other';
}

async function fetchFromJQuants(): Promise<FetchCompanyMasterResult> {
  const { data } = await jquantsApi.get('/equities/master', {}, { cacheable: true });
  const infos = (data.data as Record<string, unknown>[] | undefined) ?? [];

  const companies: CompanyInfo[] = infos
    .map((c) => {
      const rawCode = String(c.Code ?? '').trim();
      if (!rawCode) return null;
      // J-Quantsのコードは5桁（末尾0付き）→ 先頭4桁を使う
      const code = rawCode.slice(0, 4);
      return {
        code,
        name: String(c.Name ?? ''),
        market: parseJQuantsMarket(String(c.MktNm ?? '')),
      };
    })
    .filter((c): c is CompanyInfo => c !== null);

  // 重複除去
  const seen = new Set<string>();
  const unique = companies.filter((c) => {
    if (seen.has(c.code)) return false;
    seen.add(c.code);
    return true;
  });

  return { companies: unique, source: 'jquants' };
}

/** 銘柄マスタを取得。FINANCE_PROVIDER に応じてプロバイダーを選択 */
export async function fetchCompanyMaster(): Promise<FetchCompanyMasterResult> {
  const provider = (process.env.FINANCE_PROVIDER ?? 'auto').toLowerCase();
  const tse = new TseMasterProvider();

  if (provider === 'yahoo') {
    // Yahoo は銘柄一覧を提供しないので TSE CSV を使う
    return tse.fetchAll();
  }

  if (provider === 'jquants') {
    return fetchFromJQuants();
  }

  // auto: J-Quants APIキーがなければ即座にTSE CSVへ
  if (!process.env.JQUANTS_API_KEY) {
    return tse.fetchAll();
  }

  // auto: J-Quantsを試してダメならTSE CSV
  try {
    return await fetchFromJQuants();
  } catch {
    return tse.fetchAll();
  }
}
