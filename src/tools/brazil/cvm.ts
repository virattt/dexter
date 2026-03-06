/**
 * CVM (Comissão de Valores Mobiliários) integration.
 * Fetches official DFP (Demonstrações Financeiras Padronizadas) data from public CVM datasets.
 *
 * Strategy:
 * 1. Download the yearly DFP ZIP file from dados.cvm.gov.br
 * 2. Parse the ZIP archive using native Node.js zlib (no external dependencies)
 * 3. Extract and filter relevant CSV rows by CD_CVM
 * 4. Return structured financial statements (DRE, Balanço, DFC)
 */

import { createInflateRaw } from 'node:zlib';
import { Readable } from 'node:stream';

const CVM_DFP_BASE = 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/DFP/DADOS/';

// Maps well-known tickers to their CVM company code (CD_CVM zero-padded to 6 digits)
const KNOWN_CD_CVM: Record<string, string> = {
  PETR4: '009512', PETR3: '009512',
  VALE3: '004170',
  ITUB4: '019348', ITUB3: '019348',
  BBAS3: '001023',
  ABEV3: '016748',
  WEGE3: '005410',
  RENT3: '020575',
  ELET3: '002437', ELET6: '002437',
  SUZB3: '021474',
  RADL3: '019373',
  LREN3: '017493',
  MGLU3: '020540',
  HYPE3: '019658',
  JBSS3: '020737',
  BPAC11: '017304',
  BBDC4: '000906', BBDC3: '000906',
  SANB11: '022200',
  ITSA4: '019659',
  CSAN3: '021213',
  PRIO3: '022187',
  EMBR3: '007615',
  AZUL4: '022936',
  COGN3: '021903',
  GOLL4: '021105',
  EQTL3: '018376',
  TAEE11: '020990',
  EGIE3: '004154',
  CPLE6: '003298',
  ENBR3: '019615',
  RAIL3: '018104',
};

export interface CvmStatement {
  dre?: Record<string, number>;
  balanco?: Record<string, number>;
  fluxoCaixa?: Record<string, number>;
  acoes?: Record<string, number>;
  referenceDate?: string;
  source: 'CVM';
}

// ─────────────────────────────────────────────────────────────── ZIP parser ──

/**
 * Find all ZIP entries in a buffer by reading the Central Directory.
 */
function findZipEntries(buf: Buffer) {
  const entries = new Map<string, { offset: number; method: number; compressedSize: number }>();
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) return entries;

  const cdOffset = buf.readUInt32LE(eocd + 16);
  const cdSize   = buf.readUInt32LE(eocd + 12);
  let pos = cdOffset;

  while (pos < cdOffset + cdSize) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) break;
    const method         = buf.readUInt16LE(pos + 10);
    const compressedSize = buf.readUInt32LE(pos + 20);
    const fnLen          = buf.readUInt16LE(pos + 28);
    const extLen         = buf.readUInt16LE(pos + 30);
    const cmtLen         = buf.readUInt16LE(pos + 32);
    const localOffset    = buf.readUInt32LE(pos + 42);
    const name           = buf.subarray(pos + 46, pos + 46 + fnLen).toString('utf8');
    entries.set(name, { offset: localOffset, method, compressedSize });
    pos += 46 + fnLen + extLen + cmtLen;
  }
  return entries;
}

/**
 * Extract and decompress a specific file from a ZIP buffer.
 */
async function extractEntry(buf: Buffer, name: string, entries: ReturnType<typeof findZipEntries>): Promise<string | null> {
  const entry = entries.get(name);
  if (!entry) return null;

  const fnLen    = buf.readUInt16LE(entry.offset + 26);
  const extLen   = buf.readUInt16LE(entry.offset + 28);
  const dataStart = entry.offset + 30 + fnLen + extLen;
  const compressed = buf.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.method === 0) {
    return compressed.toString('latin1');
  }
  if (entry.method === 8) {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const infl = createInflateRaw();
      infl.on('data', (d: Buffer) => chunks.push(d));
      infl.on('end', () => resolve(Buffer.concat(chunks).toString('latin1')));
      infl.on('error', reject);
      Readable.from(compressed).pipe(infl);
    });
  }
  return null;
}

// ────────────────────────────────────────────────── Account code mapping ──

const DRE_ACCOUNTS: Record<string, string> = {
  '3.01':  'receitaLiquida',
  '3.02':  'custoProdutosVendidos',
  '3.03':  'lucroBruto',
  '3.04':  'despesasOperacionais',
  '3.05':  'ebit',
  '3.06':  'resultadoFinanceiro',
  '3.08':  'lucroAntesIR',
  '3.09':  'irContribuicaoSocial',
  '3.11':  'lucroLiquidoOperacoesDescontinuadas',
  '3.99':  'lucroLiquido',
};

const BPA_ACCOUNTS: Record<string, string> = {
  '1':       'ativoTotal',
  '1.01':    'ativoCirculante',
  '1.01.01': 'caixaEquivalentes',
  '1.01.02': 'aplicacoesFinanceiras',
  '1.01.03': 'contasAReceber',
  '1.01.04': 'estoques',
  '1.02':    'ativoNaoCirculante',
  '1.02.04': 'imovilizadoLiquido',
};

const BPP_ACCOUNTS: Record<string, string> = {
  '2':       'passivoTotal',
  '2.01':    'passivoCirculante',
  '2.01.04': 'dividasCirculante',      // Empréstimos e financiamentos CP
  '2.01.05': 'debenturesCirculante',   // Debêntures CP
  '2.02':    'passivoNaoCirculante',
  '2.02.01': 'dividasLongoPrazo',      // Empréstimos e financiamentos LP
  '2.02.02': 'debenturesLongoPrazo',   // Debêntures LP
  '2.03':    'patrimonioLiquido',
};

// DFC — Método Indireto (código 6.xx) e Direto (também 6.xx em muitos casos)
const DFC_ACCOUNTS: Record<string, string> = {
  '6.01':    'fluxoOperacional',       // Cash Flow from Operations (CFO)
  '6.02':    'fluxoInvestimentos',     // Total investing (used for FCF fallback)
  '6.02.01': 'capexAquisicaoAtivos',   // CAPEX: Aquisição de imobilizado/intangível
  '6.02.02': 'capexAlienacaoAtivos',   // Proceeds from asset sales
  '6.03':    'fluxoFinanciamentos',
};

// Composição do capital — share count
const COMP_CAP_ACCOUNTS: Record<string, string> = {
  'ON':  'acoesOrdinarias',
  'PN':  'acoesPreferenciais',
  'UNT': 'units',
};

// ──────────────────────────────────────────────────────── CSV row parser ──

function parseLine(line: string): string[] {
  return line.split(';').map(v => v.trim().replace(/^"|"$/g, ''));
}

/**
 * Filter CSV rows for a specific CD_CVM and extract account values.
 * Only keeps rows where ORDEM_EXERC = 'ÚLTIMO' (most recent period).
 */
function extractAccounts(
  csvText: string,
  cdCvm: string,
  accountMap: Record<string, string>,
): { data: Record<string, number>; referenceDate: string } {
  const lines = csvText.split('\n');
  const header = parseLine(lines[0]);
  const colCdCvm    = header.indexOf('CD_CVM');
  const colCdConta  = header.indexOf('CD_CONTA');
  const colVlConta  = header.indexOf('VL_CONTA');
  const colOrdem    = header.indexOf('ORDEM_EXERC');
  const colDtFim    = header.indexOf('DT_FIM_EXERC');

  const data: Record<string, number> = {};
  let referenceDate = '';

  // Normalize target CD_CVM (CVM pads to 6 digits in some files)
  const targets = [cdCvm, cdCvm.replace(/^0+/, ''), cdCvm.padStart(6, '0')];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (!targets.includes(cols[colCdCvm])) continue;
    // CSV is latin1-decoded; 'ÚLTIMO' may not match exactly due to encoding.
    // Keep only the most recent period: rows where ORDEM_EXERC ends with 'LTIMO' (i.e. ÚLTIMO, not PENÚLTIMO).
    if (colOrdem >= 0 && !cols[colOrdem].endsWith('LTIMO')) continue;
    if (colOrdem >= 0 && cols[colOrdem].includes('PEN')) continue;

    const cd  = cols[colCdConta];
    const key = accountMap[cd];
    if (!key) continue;

    const vl = parseFloat(cols[colVlConta]);
    if (!isNaN(vl)) {
      data[key] = vl;
      if (!referenceDate && cols[colDtFim]) referenceDate = cols[colDtFim];
    }
  }
  return { data, referenceDate };
}


// ────────────────────────────────────────────────────────── Main function ──

/** Download CVM DFP ZIP and extract financial statements for the given ticker. */
export async function fetchCvmFundamentals(ticker: string): Promise<CvmStatement | null> {
  const normalized = ticker.replace(/\.SA$/i, '').toUpperCase();
  const cdCvm = KNOWN_CD_CVM[normalized];
  if (!cdCvm) return null;

  const currentYear = new Date().getFullYear();
  for (const year of [currentYear, currentYear - 1]) {
    const result = await fetchDfpForYear(cdCvm, year);
    if (result) return result;
  }
  return null;
}

/**
 * Parse the capital composition CSV to extract share counts.
 */
function extractShareCount(csvText: string, cdCvm: string): Record<string, number> | null {
  const lines = csvText.split('\n');
  if (lines.length < 2) return null;
  const header = parseLine(lines[0]);
  const cdCvmIdx  = header.indexOf('CD_CVM');
  const ordemIdx  = header.indexOf('ORDEM_EXERC');
  const ordIdx    = header.findIndex(h => h.includes('ORDINARIA') && !h.includes('TESOURARIA'));
  const prefIdx   = header.findIndex(h => h.includes('PREFERENCIAL') && !h.includes('TESOURARIA'));
  const totalIdx  = header.findIndex(h => h.includes('TOTAL') && !h.includes('TESOURARIA'));

  const targets = [cdCvm, cdCvm.replace(/^0+/, ''), cdCvm.padStart(6, '0')];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (!targets.includes(cols[cdCvmIdx])) continue;
    if (ordemIdx >= 0 && !cols[ordemIdx].endsWith('LTIMO')) continue;
    if (ordemIdx >= 0 && cols[ordemIdx].includes('PEN')) continue;

    const result: Record<string, number> = {};
    const ord   = ordIdx >= 0   ? parseInt(cols[ordIdx], 10)   : NaN;
    const pref  = prefIdx >= 0  ? parseInt(cols[prefIdx], 10)  : NaN;
    const total = totalIdx >= 0 ? parseInt(cols[totalIdx], 10) : NaN;

    if (!isNaN(ord))   result.acoesOrdinarias    = ord;
    if (!isNaN(pref))  result.acoesPreferenciais = pref;
    if (!isNaN(total)) result.totalAcoes          = total;
    else if (!isNaN(ord + pref)) result.totalAcoes = ord + pref;

    return result;
  }
  return null;
}

async function fetchDfpForYear(cdCvm: string, year: number): Promise<CvmStatement | null> {
  try {
    const url = `${CVM_DFP_BASE}dfp_cia_aberta_${year}.zip`;
    const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) return null;

    const arrayBuffer = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    const entries = findZipEntries(buf);

    const dreFile  = `dfp_cia_aberta_DRE_con_${year}.csv`;
    const bpaFile  = `dfp_cia_aberta_BPA_con_${year}.csv`;
    const bppFile  = `dfp_cia_aberta_BPP_con_${year}.csv`;
    const dfcFile  = `dfp_cia_aberta_DFC_MI_con_${year}.csv`;
    const capFile  = `dfp_cia_aberta_composicao_capital_${year}.csv`;

    const [dreCsv, bpaCsv, bppCsv, dfcCsv, capCsv] = await Promise.all([
      extractEntry(buf, dreFile, entries),
      extractEntry(buf, bpaFile, entries),
      extractEntry(buf, bppFile, entries),
      extractEntry(buf, dfcFile, entries),
      extractEntry(buf, capFile, entries),
    ]);

    const dreResult = dreCsv ? extractAccounts(dreCsv, cdCvm, DRE_ACCOUNTS) : null;
    const bpaResult = bpaCsv ? extractAccounts(bpaCsv, cdCvm, BPA_ACCOUNTS) : null;
    const bppResult = bppCsv ? extractAccounts(bppCsv, cdCvm, BPP_ACCOUNTS) : null;
    const dfcResult = dfcCsv ? extractAccounts(dfcCsv, cdCvm, DFC_ACCOUNTS) : null;
    const shareData = capCsv ? extractShareCount(capCsv, cdCvm) : null;

    const dre     = dreResult?.data ?? {};
    const balanco = { ...(bpaResult?.data ?? {}), ...(bppResult?.data ?? {}) };
    const dfc     = dfcResult?.data ?? {};
    const referenceDate = dreResult?.referenceDate ?? bpaResult?.referenceDate ?? `${year}-12-31`;

    if (Object.keys(dre).length === 0 && Object.keys(balanco).length === 0) return null;

    // ─── Computed/derived fields ────────────────────────────────────────
    // Dívida bruta = empréstimos + debêntures (CP + LP)
    const dividaBruta =
      ((balanco.dividasCirculante ?? 0) + (balanco.debenturesCirculante ?? 0)) +
      ((balanco.dividasLongoPrazo ?? 0) + (balanco.debenturesLongoPrazo ?? 0));
    if (dividaBruta > 0) balanco.dividaBrutaTotal = dividaBruta;

    // Caixa total = caixa + aplicações financeiras CP
    const caixaTotal = (balanco.caixaEquivalentes ?? 0) + (balanco.aplicacoesFinanceiras ?? 0);
    if (caixaTotal > 0) balanco.caixaTotalDisponivel = caixaTotal;

    // Dívida líquida = dívida bruta − caixa total
    if (dividaBruta > 0 || caixaTotal > 0) {
      balanco.dividaLiquida = dividaBruta - caixaTotal;
    }

    // FCF = CFO + CAPEX (CAPEX is negative outflow in CVM DFC)
    const cfo   = dfc.fluxoOperacional ?? 0;
    const capex = dfc.capexAquisicaoAtivos ?? 0;
    if (cfo !== 0) {
      dfc.fluxoCaixaLivre = cfo + capex; // capex already negative → FCF = CFO - |CAPEX|
    }

    return {
      dre: Object.keys(dre).length > 0 ? dre : undefined,
      balanco: Object.keys(balanco).length > 0 ? balanco : undefined,
      fluxoCaixa: Object.keys(dfc).length > 0 ? dfc : undefined,
      acoes: shareData ?? undefined,
      referenceDate,
      source: 'CVM',
    };
  } catch {
    return null;
  }
}

