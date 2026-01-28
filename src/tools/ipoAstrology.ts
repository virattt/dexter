/**
 * IPO Astrology Tool - Alternative Data Analysis
 *
 * "Standard quantitative analysis is great, but markets are irrational."
 *
 * This experimental tool adds a "Metaphysical Sentiment" layer by analyzing
 * the WuXing (Five Elements) interactions of a company's IPO date against
 * the current year using Chinese Metaphysics (BaZi/Five Elements).
 *
 * Cyber-Mysticism: Serious implementation of a "fun" concept.
 *
 * Uses `lunar-javascript` for precise astronomical calculation.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Solar } from 'lunar-javascript';

// Heavenly Stems (天干) to WuXing (Five Elements) mapping
const STEM_TO_ELEMENT: Record<string, string> = {
  '甲': 'Wood',
  '乙': 'Wood',
  '丙': 'Fire',
  '丁': 'Fire',
  '戊': 'Earth',
  '己': 'Earth',
  '庚': 'Metal',
  '辛': 'Metal',
  '壬': 'Water',
  '癸': 'Water',
};

// WuXing element names in Chinese for output
const ELEMENT_CHINESE: Record<string, string> = {
  'Wood': '木',
  'Fire': '火',
  'Earth': '土',
  'Metal': '金',
  'Water': '水',
};

// Generating cycle (生): A -> B means A generates B
// Wood → Fire → Earth → Metal → Water → Wood
const GENERATES: Record<string, string> = {
  'Wood': 'Fire',
  'Fire': 'Earth',
  'Earth': 'Metal',
  'Metal': 'Water',
  'Water': 'Wood',
};

// Overcoming cycle (克): A -> B means A overcomes B
// Wood → Earth → Water → Fire → Metal → Wood
const OVERCOMES: Record<string, string> = {
  'Wood': 'Earth',
  'Earth': 'Water',
  'Water': 'Fire',
  'Fire': 'Metal',
  'Metal': 'Wood',
};

/**
 * Analyze the WuXing interaction between two elements
 */
function analyzeInteraction(
  currentYearElement: string,
  dayMasterElement: string
): { type: 'harmony' | 'conflict' | 'support' | 'drain' | 'peer'; description: string } {
  // Harmony: Current year generates Day Master (beneficial)
  if (GENERATES[currentYearElement] === dayMasterElement) {
    return {
      type: 'harmony',
      description: `${currentYearElement} generates ${dayMasterElement} → supportive energy, favorable conditions`,
    };
  }

  // Conflict: Current year overcomes Day Master (challenging)
  if (OVERCOMES[currentYearElement] === dayMasterElement) {
    return {
      type: 'conflict',
      description: `${currentYearElement} overcomes ${dayMasterElement} → external pressure indicated`,
    };
  }

  // Support: Day Master generates Current Year (draining energy from company)
  if (GENERATES[dayMasterElement] === currentYearElement) {
    return {
      type: 'drain',
      description: `${dayMasterElement} generates ${currentYearElement} → energy expenditure, output-focused year`,
    };
  }

  // Counter: Day Master overcomes Current Year (company exerts control)
  if (OVERCOMES[dayMasterElement] === currentYearElement) {
    return {
      type: 'support',
      description: `${dayMasterElement} overcomes ${currentYearElement} → assertive positioning, competitive advantage`,
    };
  }

  // Same element: peer relationship
  return {
    type: 'peer',
    description: `Both ${currentYearElement} → peer energy, competition and collaboration`,
  };
}

/**
 * Get the Heavenly Stem element for a given date
 */
function getDayMasterElement(year: number, month: number, day: number): { stem: string; element: string } {
  const solar = Solar.fromYmd(year, month, day);
  const lunar = solar.getLunar();
  const eightChar = lunar.getEightChar();
  const dayGan = eightChar.getDayGan();

  return {
    stem: dayGan,
    element: STEM_TO_ELEMENT[dayGan] || 'Unknown',
  };
}

/**
 * Get the current BaZi year's Heavenly Stem element (uses 立春 Lichun as year boundary)
 */
function getCurrentYearElement(): { year: number; stem: string; element: string } {
  const now = new Date();
  const solar = Solar.fromYmd(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const lunar = solar.getLunar();

  // getYearGanExact uses 立春 (Start of Spring) as the year boundary
  // This is the traditional BaZi year calculation method
  const yearGan = lunar.getYearGanExact();

  return {
    year: now.getFullYear(),
    stem: yearGan,
    element: STEM_TO_ELEMENT[yearGan] || 'Unknown',
  };
}

// Tool description for system prompt injection
export const IPO_ASTROLOGY_DESCRIPTION = `\
**IPO Astrology Tool** - Alternative Data / Metaphysical Sentiment Analysis

Analyzes a company's IPO date using Chinese Metaphysics (BaZi/Five Elements) to provide
an esoteric perspective on the company's "elemental nature" and its interaction with
the current year's energy.

**When to use:**
- When the user asks for "alternative data" or unconventional analysis
- To add a cultural/esoteric dimension to financial research
- For experimental/exploratory analysis alongside traditional metrics

**When NOT to use:**
- As a primary investment decision tool (this is supplementary/experimental)
- When the user explicitly wants only quantitative analysis

**Input:**
- ticker: Company ticker symbol (e.g., "TSLA")
- ipoDate: IPO date in YYYY-MM-DD format (e.g., "2010-06-29")

**Output:**
A summary including:
- Day Master element (company's "Self" based on IPO date)
- Current BaZi Year element
- WuXing interaction analysis (Harmony/Conflict/Support/Drain/Peer)
- Interpretation with metaphysical guidance

**Note:** Uses lunar-javascript for precise astronomical calculation with traditional
立春 (Lichun/Start of Spring) year boundary.`;

export const ipoAstrology = new DynamicStructuredTool({
  name: 'ipo_astrology',
  description:
    'Analyze a company IPO date using Chinese Metaphysics (BaZi/Five Elements) for alternative/esoteric sentiment analysis.',
  schema: z.object({
    ticker: z.string().describe('Company ticker symbol (e.g., "TSLA", "AAPL")'),
    ipoDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .describe('IPO date in YYYY-MM-DD format (e.g., "2010-06-29")'),
  }),
  func: async (input) => {
    const { ticker, ipoDate } = input;

    // Parse IPO date
    const [yearStr, monthStr, dayStr] = ipoDate.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);

    // Validate date
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return `Error: Invalid date format. Please provide date as YYYY-MM-DD.`;
    }

    try {
      // Get Day Master (company's "Self")
      const dayMaster = getDayMasterElement(year, month, day);

      // Get Current Year's element
      const currentYear = getCurrentYearElement();

      // Analyze interaction
      const interaction = analyzeInteraction(currentYear.element, dayMaster.element);

      // Format output
      const interactionEmoji =
        interaction.type === 'harmony'
          ? '🌱'
          : interaction.type === 'conflict'
            ? '⚡'
            : interaction.type === 'support'
              ? '💪'
              : interaction.type === 'drain'
                ? '💨'
                : '🤝';

      const summary = [
        `**${ticker.toUpperCase()} - IPO Astrology Analysis**`,
        ``,
        `📅 IPO Date: ${ipoDate}`,
        `🏷️ Day Master: ${dayMaster.stem} (${dayMaster.element}/${ELEMENT_CHINESE[dayMaster.element]})`,
        `📆 Current BaZi Year (${currentYear.year}): ${currentYear.stem} (${currentYear.element}/${ELEMENT_CHINESE[currentYear.element]})`,
        ``,
        `${interactionEmoji} **Interaction: ${interaction.type.charAt(0).toUpperCase() + interaction.type.slice(1)}**`,
        `${interaction.description}`,
        ``,
        `---`,
        `*Note: This is experimental alternative data analysis using Chinese Metaphysics.*`,
        `*WuXing cycles: Wood→Fire→Earth→Metal→Water→Wood (生 generates)*`,
        `*Wood→Earth→Water→Fire→Metal→Wood (克 overcomes)*`,
      ].join('\n');

      return summary;
    } catch (error) {
      return `Error analyzing IPO date: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
});

// Factory function for consistency with other tools
export function createIpoAstrology(): DynamicStructuredTool {
  return ipoAstrology;
}
