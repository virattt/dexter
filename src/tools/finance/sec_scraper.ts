import axios from "axios";
import * as cheerio from "cheerio";
import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { formatToolResult } from '../types.js';
import * as fs from 'fs';
import * as path from 'path';

// User-Agent and request headers for SEC
const BASE_USER_AGENT = "AbelResearchBot/1.0 (tr7@example.com)";
const SEC_HEADERS = {
  "User-Agent": BASE_USER_AGENT,
  "Accept-Encoding": "gzip, deflate, br",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1"
};

// Ticker→CIK map: local file first, then SEC download
let globalTickerMap: Record<string, string> | null = null;

// Optional: company_tickers.json at project root
const LOCAL_TICKER_PATH = path.join(process.cwd(), 'company_tickers.json');

async function loadTickerMap(): Promise<Record<string, string> | null> {
  if (globalTickerMap) return globalTickerMap;

  // 1. Try local file first
  if (fs.existsSync(LOCAL_TICKER_PATH)) {
    try {
      console.log(`[SEC] 📖 Reading local ticker map from: ${LOCAL_TICKER_PATH}`);
      const rawData = fs.readFileSync(LOCAL_TICKER_PATH, 'utf-8');
      const data = JSON.parse(rawData);

      const map: Record<string, string> = {};
      // Parse SEC JSON: { "0": { "cik_str": 123, "ticker": "AAPL" }, ... }
      Object.values(data).forEach((item: any) => {
        map[item.ticker] = item.cik_str.toString().padStart(10, '0');
      });

      console.log(`[SEC] ✅ Loaded ${Object.keys(map).length} companies from local file.`);
      globalTickerMap = map;
      return map;
    } catch (e) {
      console.error("[SEC] ❌ Failed to parse local JSON:", e);
    }
  }

  // 2. Fallback: fetch from SEC if local file missing
  console.log("[SEC] ⚠️ Local file not found. Attempting download from SEC...");
  try {
    const res = await axios.get("https://www.sec.gov/files/company_tickers.json", {
      headers: SEC_HEADERS,
      timeout: 5000
    });
    const map: Record<string, string> = {};
    Object.values(res.data).forEach((item: any) => {
      map[item.ticker] = item.cik_str.toString().padStart(10, '0');
    });
    globalTickerMap = map;
    return map;
  } catch (e) {
    console.error("[SEC] ❌ Network download failed:", e);
    return null;
  }
}

async function getCik(ticker: string): Promise<string | null> {
  const t = ticker.toUpperCase();
  const map = await loadTickerMap();

  if (map && map[t]) {
    console.log(`[SEC] 🔍 Resolved ${t} -> CIK: ${map[t]}`);
    return map[t];
  }

  // Hardcode common ETFs/new listings not in SEC JSON
  const HARDCODED: Record<string, string> = {
    "SPY": "0000884394",
    "QQQ": "0001067839"
  };
  if (HARDCODED[t]) return HARDCODED[t];

  return null;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Payload parsing and content extraction
type Payload = { type: string; description: string; link: string; role: "CONTAINER" | "PAYLOAD"; };

function addPayloadIfValid(docType: string, desc: string, link: string, list: Payload[], seen: Set<string>) {
  if (!link) return;
  const fullLink = link.startsWith("/") ? `https://www.sec.gov${link}` : link;
  if (seen.has(fullLink)) return;

  let cleanType = docType.toUpperCase();
  if (cleanType.startsWith("EXHIBIT")) cleanType = cleanType.replace("EXHIBIT", "EX-").trim();
  if (cleanType.startsWith("EX ")) cleanType = cleanType.replace("EX ", "EX-").trim();

  const isPrimary = ["8-K", "6-K", "10-Q", "10-K", "20-F"].some(t => cleanType.includes(t));
  const isExhibit = cleanType.startsWith("EX-") || cleanType.includes("99.1") || cleanType.includes("99.2");

  if (isPrimary || isExhibit) {
    if (cleanType.includes("99.1") || desc.toLowerCase().includes("press release")) {
      desc = `🔥 ${desc}`;
    }
    list.push({ type: cleanType, description: desc, link: fullLink, role: isPrimary ? "CONTAINER" : "PAYLOAD" });
    seen.add(fullLink);
  }
}

async function getFilingPayloadLinks(cik: string, accessionNumber: string): Promise<Payload[]> {
  if (!cik || !accessionNumber) return [];
  const accNoDash = accessionNumber.replace(/-/g, "");
  const indexUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${accNoDash}/${accessionNumber}-index.html`;

  try {
    await sleep(200);
    console.log(`[SEC] Fetching Index: ${indexUrl}`);
    const res = await axios.get(indexUrl, { headers: SEC_HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);
    const payloads: Payload[] = [];
    const seenLinks = new Set<string>();

    $("table.tableFile tr").each((_, row) => {
      const cols = $(row).find("td");
      let docType = "", description = "", link: string | undefined;
      cols.each((i, col) => {
        const text = $(col).text().trim();
        if (/^(8-K|6-K|10-Q|10-K|EX-)/i.test(text)) {
          docType = text;
          if (i > 0) description = $(cols[i - 1]).text().trim();
          if (i > 1) link = $(cols[i - 2]).find("a").attr("href");
        }
      });
      if (!link && cols.length >= 3) {
        link = $(row).find("a").attr("href");
        if (cols.length > 3) docType = $(cols[3]).text().trim();
        if (cols.length > 1) description = $(cols[1]).text().trim();
      }
      if (link && docType) addPayloadIfValid(docType, description, link, payloads, seenLinks);
    });

    const has991 = payloads.some(p => p.type.includes("99.1"));
    if (!has991) {
      console.log("[SEC] Strategy A missed 99.1, engaging Brute Force Search...");
      $("a").each((_, el) => {
        const link = $(el).attr("href");
        const text = $(el).text().trim();
        const fullRowText = $(el).closest("tr").text().trim();
        if (!link || !link.endsWith(".htm")) return;
        const targetPattern = /((exhibit|ex)[-\s_.]?99|99\.[12]|press\s*release)/i;
        if (targetPattern.test(text) || targetPattern.test(fullRowText) || targetPattern.test(link)) {
          let type = "EX-Unknown";
          if (text.includes("99.1") || fullRowText.includes("99.1")) type = "EX-99.1";
          else if (text.includes("99.2") || fullRowText.includes("99.2")) type = "EX-99.2";
          addPayloadIfValid(type, `🔥 Found via BruteForce: ${text}`, link, payloads, seenLinks);
        }
      });
    }
    if (payloads.length === 0) payloads.push({ type: "PRIMARY", description: "Main Document", link: indexUrl, role: "CONTAINER" });
    return payloads;
  } catch (err) { return []; }
}

async function extractContent(url: string): Promise<string> {
  try {
    await sleep(300);
    console.log(`[SEC] Extracting Content from: ${url}`);
    const res = await axios.get(url, { headers: SEC_HEADERS, timeout: 20000 });
    const $ = cheerio.load(res.data);
    $('script, style, svg, img, link, iframe').remove();
    let markdown = `Source: ${url}\n\n`;

    $('table').each((i, table) => {
      const $table = $(table);
      const rows: string[][] = [];
      $table.find('tr').each((_, tr) => {
        const rowData: string[] = [];
        $(tr).find('td, th').each((_, td) => {
          let text = $(td).text().replace(/[\r\n]+/g, " ").replace(/\s+/g, ' ').trim();
          if (text) rowData.push(text);
        });
        if (rowData.length > 0) rows.push(rowData);
      });
      if (rows.length < 2) return;
      let title = `Table ${i + 1}`;
      let prev = $table.prev();
      for (let k = 0; k < 3; k++) {
        const txt = prev.text().trim();
        if (txt.length > 5 && txt.length < 100) { title = txt; break; }
        prev = prev.prev();
      }
      markdown += `### ${title}\n`;
      if (rows.length > 0) {
        markdown += `| ${rows[0].join(' | ')} |\n`;
        markdown += `| ${rows[0].map(() => '---').join(' | ')} |\n`;
        rows.slice(1).forEach(row => markdown += `| ${row.join(' | ')} |\n`);
      }
      markdown += `\n---\n`;
    });

    if (markdown.length < 200) {
      markdown += "\n### Full Text Preview\n";
      $('p, div, font').each((_, el) => {
        const t = $(el).text().replace(/\s+/g, ' ').trim();
        if (t.length > 100) markdown += `\n${t}\n`;
      });
      if (markdown.length > 20000) markdown = markdown.substring(0, 20000) + "...(truncated)";
    }
    return markdown;
  } catch (e) { return `Error extracting content: ${e}`; }
}

const SECScraperInputSchema = z.object({
  ticker: z.string().optional(),
  url: z.string().optional(),
});

export const getDirectSecFilings = new DynamicStructuredTool({
  name: 'get_direct_sec_filings',
  description: `DIRECTLY scrapes SEC EDGAR.`,
  schema: SECScraperInputSchema,
  func: async (input) => {
    try {
      if (input.url) {
        const content = await extractContent(input.url);
        return formatToolResult({ url: input.url, content }, []);
      }
      if (!input.ticker) return formatToolResult({ error: "Need ticker" }, []);

      const cik = await getCik(input.ticker);
      if (!cik) return formatToolResult({ error: `CIK not found for ${input.ticker}. Ticker may be new or delisted.` }, []);

      const listUrl = `https://data.sec.gov/submissions/CIK${cik}.json`;
      const listResp = await axios.get(listUrl, { headers: SEC_HEADERS });
      const recent = listResp.data.filings.recent;

      // Scan depth 80: active companies may have many Form 4s pushing 8-K/6-K further down
      const SCAN_DEPTH = 80;
      console.log(`[SEC] Scanning top ${SCAN_DEPTH} filings for ${input.ticker}...`);

      for (let i = 0; i < Math.min(recent.form.length, SCAN_DEPTH); i++) {
        const formType = recent.form[i];
        if (formType !== '8-K' && formType !== '6-K') continue;

        const acc = recent.accessionNumber[i];
        const date = recent.filingDate[i];
        console.log(`[SEC] 🔎 Found ${formType} at index ${i} (Date: ${date})`);
        console.log(`[SEC] 📥 Analyzing Payload for ${acc}...`);

        const payloads = await getFilingPayloadLinks(cik, acc);
        const bestPayload = payloads.find(p => p.type.includes("99.1") || p.description.includes("🔥")) ||
          payloads.find(p => p.type.includes("99.2")) ||
          payloads.find(p => p.type.includes("EX-99")) ||
          payloads.find(p => p.role === "CONTAINER");

        if (bestPayload) {
          console.log(`[SEC] 🎯 Target Locked: ${bestPayload.type} (${bestPayload.link})`);
          const content = await extractContent(bestPayload.link);
          return formatToolResult({
            ticker: input.ticker,
            filingDate: date,
            docType: bestPayload.type,
            docDesc: bestPayload.description,
            url: bestPayload.link,
            content: content
          }, []);
        }
      }

      console.log(`[SEC] ❌ No 8-K/6-K found in the last ${SCAN_DEPTH} filings.`);
      return formatToolResult({ error: `No recent 8-K/6-K filings found for ${input.ticker} (Checked top ${SCAN_DEPTH} docs).` }, []);
    } catch (error) {
      console.error("Scraper crash:", error);
      return formatToolResult({ error: `Scraper Error: ${error}` }, []);
    }
  },
});