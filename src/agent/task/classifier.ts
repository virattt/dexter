import { callLlm, getFastModel } from '../../model/llm.js';
import { extractTextContent } from '../../utils/ai-message.js';

/**
 * Complexity classification result
 */
export interface ComplexityResult {
  isComplex: boolean;
  reason: string;
  estimatedSteps?: number;
}

/**
 * Classifies query complexity to determine if task planning is needed.
 * Uses LLM-first approach for 90%+ accuracy.
 */
export class ComplexityClassifier {
  /**
   * Classify query complexity using LLM with few-shot examples
   */
  static async classify(
    query: string,
    model: string,
    modelProvider: string
  ): Promise<ComplexityResult> {
    // Only use heuristics for VERY obvious simple cases to save API calls
    const obviouslySimple = this.isObviouslySimple(query);
    if (obviouslySimple) {
      return {
        isComplex: false,
        reason: 'Single metric lookup',
        estimatedSteps: 1,
      };
    }

    // Use LLM for everything else (90%+ accuracy)
    return await this.llmClassify(query, model, modelProvider);
  }

  /**
   * Quick filter for VERY obvious simple queries (saves API calls)
   */
  private static isObviouslySimple(query: string): boolean {
    const lower = query.toLowerCase().trim();
    
    // Ultra-simple patterns only
    const obviouslySimplePatterns = [
      /^what (is|was|were) [A-Z]{2,5} (price|revenue|market cap)$/i,
      /^(get|show) [A-Z]{2,5} (price|revenue|stock price)$/i,
    ];

    return obviouslySimplePatterns.some(p => p.test(lower));
  }

  /**
   * LLM-based classification with few-shot examples for high accuracy
   */
  private static async llmClassify(
    query: string,
    model: string,
    modelProvider: string
  ): Promise<ComplexityResult> {
    // Use the same model for classification (simpler and more reliable)
    const classifierModel = model;

    const prompt = `You are a query complexity classifier for a financial research AI agent.

Task: Classify if a query needs TASK PLANNING (complex) or can be handled in ONE agent iteration (simple).

═══════════════════════════════════════════════════════════════════
DECISION CRITERIA
═══════════════════════════════════════════════════════════════════

Mark as SIMPLE if the query:
✓ Asks for ONE data point (single metric, single company, single timeframe)
✓ Can be answered with ONE tool call
✓ Requires NO calculations, comparisons, or synthesis
✓ Has NO temporal analysis (trends, growth rates, changes)

Mark as COMPLEX if the query has ANY of:
✗ Multiple companies (2+)
✗ Multiple DIFFERENT metrics requiring separate lookups
✗ Calculations/derivations (growth rates, ratios, aggregations)
✗ Comparisons (A vs B, rank, top N, best/worst)
✗ Temporal analysis (trends over time, YoY/QoQ changes)
✗ Sequential dependencies (fetch X, then calculate Y, then compare Z)
✗ Aggregations (sum, average, total across multiple entities)
✗ Multi-step reasoning (analyze, explain, investigate)

═══════════════════════════════════════════════════════════════════
EXAMPLES
═══════════════════════════════════════════════════════════════════

SIMPLE (single lookup, direct retrieval):
• "What is AAPL's current stock price?" → 1 metric, 1 company
• "Show me Tesla's revenue" → 1 metric, 1 company
• "Get Microsoft's market cap" → 1 metric, 1 company
• "NVDA P/E ratio" → 1 metric, 1 company

COMPLEX (multiple metrics for SAME company):
• "Get AAPL P/E ratio, revenue, and profit margin" → 3 metrics, needs decomposition
• "Show me Tesla's valuation metrics" → Vague, likely multiple metrics
• "AAPL profitability analysis" → Multiple metrics (margins, ROE, etc.)

COMPLEX (multiple companies):
• "Compare AAPL and MSFT revenue" → 2 companies
• "Show me Apple, Google, and Meta market caps" → 3 companies
• "Top 5 tech companies by revenue" → Multiple companies + ranking

COMPLEX (calculations/derivations):
• "Calculate AAPL's YoY revenue growth" → Fetch revenue, then calculate
• "What's the PE-to-growth ratio for NVDA?" → Fetch PE + growth, then divide
• "AAPL's profit margin trend" → Fetch data, calculate margins over time

COMPLEX (temporal/trends):
• "How has Tesla's revenue changed over 5 years?" → Multi-year data + analysis
• "NVDA quarterly earnings trend" → Multiple quarters + trend analysis
• "Is MSFT's growth accelerating?" → Fetch growth rates + comparison

COMPLEX (comparisons/rankings):
• "Which is more profitable, AAPL or GOOGL?" → 2 companies + comparison
• "Rank FAANG stocks by market cap" → 5 companies + ranking
• "Best performing tech stock this year" → Multiple companies + analysis

═══════════════════════════════════════════════════════════════════
YOUR CLASSIFICATION
═══════════════════════════════════════════════════════════════════

Query to classify:
"${query}"

Analyze:
1. How many companies? (1 = possible simple, 2+ = complex)
2. How many DIFFERENT metrics? (1 = possible simple, 2+ = complex)
3. Any calculations/comparisons/trends? (yes = complex)
4. Can ONE tool call answer this? (yes = simple, no = complex)

Respond with ONLY valid JSON:
{
  "isComplex": true/false,
  "reason": "one-line explanation citing decision criteria",
  "estimatedSteps": 1-5
}`;

    try {
      const { response } = await callLlm(prompt, {
        model: classifierModel,
        systemPrompt: 'You are a query complexity classifier. Output ONLY valid JSON, no other text.',
        tools: undefined,
      });

      const responseText = typeof response === 'string' ? response : extractTextContent(response);
      
      // Extract JSON from response - handle various formats
      let jsonStr = responseText.trim();
      
      // Remove markdown code blocks
      const codeBlockMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      } else {
        // Try to find JSON object
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
      }
      
      // Remove single-line comments
      jsonStr = jsonStr.replace(/\/\/.*$/gm, '');
      
      // Remove multi-line comments
      jsonStr = jsonStr.replace(/\/\*[\s\S]*?\*\//g, '');
      
      // Clean up whitespace
      jsonStr = jsonStr.trim();
      
      const parsed = JSON.parse(jsonStr);
      
      return {
        isComplex: parsed.isComplex ?? true, // Default to complex if unclear
        reason: parsed.reason || 'Classified by LLM',
        estimatedSteps: parsed.estimatedSteps || (parsed.isComplex ? 3 : 1),
      };
    } catch (error) {
      // On parse error, use heuristics as fallback
      console.warn('[ComplexityClassifier] LLM classification failed, using heuristics:', error instanceof Error ? error.message : String(error));
      
      const lower = query.toLowerCase();
      
      // Pattern 1: Comparison keywords
      const hasCompareKeywords = ['compare', 'versus', 'vs', 'vs.', 'against', 'rank', 'better', 'worse'].some(kw => lower.includes(kw));
      
      // Pattern 2: Multiple companies (ticker symbols)
      const tickers = query.match(/\b[A-Z]{2,5}\b/g) || [];
      const hasMultipleCompanies = tickers.length > 1;
      
      // Pattern 3: Multiple metrics (conjunction words + metric terms)
      const hasMultipleMetrics = (
        (lower.includes(' and ') || lower.includes(',')) &&
        (lower.match(/\b(revenue|profit|margin|pe|eps|price|ratio|cap|growth|earnings)\b/g) || []).length > 1
      );
      
      // Pattern 4: Calculations/derivations
      const hasCalculations = ['calculate', 'compute', 'growth', 'change', 'yoy', 'qoq', 'trend', 'rate'].some(kw => lower.includes(kw));
      
      // Pattern 5: Temporal/trend analysis
      const hasTemporal = ['over time', 'trend', 'history', 'past', 'years', 'quarters', 'months', 'since'].some(kw => lower.includes(kw));
      
      // Pattern 6: Aggregations
      const hasAggregation = ['total', 'sum', 'average', 'top', 'best', 'worst', 'highest', 'lowest'].some(kw => lower.includes(kw));
      
      // Pattern 7: Analysis/investigation keywords
      const hasAnalysis = ['analyze', 'analysis', 'investigate', 'explain', 'why', 'how come'].some(kw => lower.includes(kw));
      
      if (hasCompareKeywords || hasMultipleCompanies || hasMultipleMetrics || hasCalculations || hasTemporal || hasAggregation || hasAnalysis) {
        const reasons = [];
        if (hasCompareKeywords) reasons.push('comparison keywords');
        if (hasMultipleCompanies) reasons.push('multiple companies');
        if (hasMultipleMetrics) reasons.push('multiple metrics');
        if (hasCalculations) reasons.push('calculations');
        if (hasTemporal) reasons.push('temporal analysis');
        if (hasAggregation) reasons.push('aggregation');
        if (hasAnalysis) reasons.push('analysis keywords');
        
        return {
          isComplex: true,
          reason: `Heuristic: detected ${reasons.join(', ')}`,
          estimatedSteps: 3,
        };
      }
      
      // When in doubt, default to complex (safer for UX)
      return {
        isComplex: true,
        reason: 'Classification failed - defaulting to complex mode for safety',
        estimatedSteps: 3,
      };
    }
  }
}
