/**
 * Fundamental Analysis Service for Laserbeam Capital
 *
 * Place this file in: laserbeamnode/services/fundamental-analysis.service.js
 *
 * This service orchestrates financial data gathering and AI analysis
 * using the hedge fund analyst format.
 */

const axios = require('axios');

class FundamentalAnalysisService {
  constructor(config) {
    this.financialDatasetsApiKey = config.financialDatasetsApiKey;
    this.tavilyApiKey = config.tavilyApiKey;
    this.openRouterApiKey = config.openRouterApiKey;
    this.alphaVantageApiKey = config.alphaVantageApiKey;
    this.databentApiKey = config.databentApiKey;

    // API clients
    this.financialDatasetsClient = axios.create({
      baseURL: 'https://api.financialdatasets.ai',
      headers: { 'X-API-KEY': this.financialDatasetsApiKey },
    });

    this.alphaVantageClient = axios.create({
      baseURL: 'https://www.alphavantage.co',
    });

    this.tavilyClient = axios.create({
      baseURL: 'https://api.tavily.com',
      headers: { 'Content-Type': 'application/json' },
    });

    this.openRouterClient = axios.create({
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        'Authorization': `Bearer ${this.openRouterApiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Main analysis entry point
   */
  async analyzeCompany(ticker, mode = null, includePortfolioContext = false) {
    try {
      // Determine analysis mode if not provided
      if (!mode) {
        mode = await this.determineAnalysisMode(ticker);
      }

      console.log(`Analyzing ${ticker} in ${mode} mode...`);

      // Gather financial data in parallel
      const dataGatheringPromises = [
        this.getCompanyOverview(ticker),
        this.getFinancialStatements(ticker),
        this.getFinancialMetrics(ticker),
        this.getCurrentPrice(ticker),
        this.getAnalystEstimates(ticker),
        this.getNews(ticker),
      ];

      // Add mode-specific data
      if (mode === 'preview' || mode === 'review') {
        dataGatheringPromises.push(this.getEarningsData(ticker));
      }

      const [
        overview,
        financials,
        metrics,
        priceData,
        estimates,
        news,
        earnings,
      ] = await Promise.all(dataGatheringPromises);

      // Perform web search for recent developments
      const webContext = await this.searchWeb(ticker, overview?.name);

      // Construct data package
      const dataPackage = {
        ticker,
        overview,
        financials,
        metrics,
        priceData,
        estimates,
        news,
        earnings,
        webContext,
      };

      // Generate analysis using OpenRouter
      const analysis = await this.generateAnalysis(dataPackage, mode);

      // Generate recommendation
      const recommendation = await this.generateRecommendation(dataPackage, analysis);

      return {
        ticker,
        company: overview?.name || ticker,
        mode,
        analysis,
        recommendation,
        rawData: dataPackage,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Error analyzing ${ticker}:`, error.message);
      throw error;
    }
  }

  /**
   * Determine which analysis mode to use based on earnings timing
   */
  async determineAnalysisMode(ticker) {
    try {
      const earningsDate = await this.getNextEarningsDate(ticker);

      if (!earningsDate) {
        return 'deep-dive';
      }

      const now = new Date();
      const earnings = new Date(earningsDate);
      const daysDiff = Math.ceil((earnings - now) / (1000 * 60 * 60 * 24));

      if (daysDiff >= 0 && daysDiff <= 7) {
        return 'preview';
      } else if (daysDiff < 0 && daysDiff >= -7) {
        return 'review';
      } else {
        return 'deep-dive';
      }
    } catch (error) {
      console.log('Could not determine mode, defaulting to deep-dive');
      return 'deep-dive';
    }
  }

  /**
   * Get company overview from Financial Datasets
   */
  async getCompanyOverview(ticker) {
    try {
      // Use financial metrics endpoint to get company info
      const response = await this.financialDatasetsClient.get(
        `/financial-metrics/snapshot?ticker=${ticker}`
      );
      return response.data;
    } catch (error) {
      console.error(`Error fetching overview for ${ticker}:`, error.message);
      return null;
    }
  }

  /**
   * Get financial statements (income, balance, cash flow)
   */
  async getFinancialStatements(ticker) {
    try {
      const response = await this.financialDatasetsClient.get(
        `/financials/all-financial-statements?ticker=${ticker}&limit=8&period=quarterly`
      );
      return response.data;
    } catch (error) {
      console.error(`Error fetching financials for ${ticker}:`, error.message);
      return null;
    }
  }

  /**
   * Get financial metrics (P/E, market cap, etc.)
   */
  async getFinancialMetrics(ticker) {
    try {
      const response = await this.financialDatasetsClient.get(
        `/financial-metrics?ticker=${ticker}&limit=8&period=quarterly`
      );
      return response.data;
    } catch (error) {
      console.error(`Error fetching metrics for ${ticker}:`, error.message);
      return null;
    }
  }

  /**
   * Get current and historical price data
   */
  async getCurrentPrice(ticker) {
    try {
      // Try Financial Datasets first
      const fdResponse = await this.financialDatasetsClient.get(
        `/prices/snapshot?ticker=${ticker}`
      );

      // Also get Alpha Vantage data for additional context
      let avData = null;
      try {
        const avResponse = await this.alphaVantageClient.get('/query', {
          params: {
            function: 'GLOBAL_QUOTE',
            symbol: ticker,
            apikey: this.alphaVantageApiKey,
          },
        });
        avData = avResponse.data['Global Quote'];
      } catch (avError) {
        console.log('Alpha Vantage price fetch failed, using Financial Datasets only');
      }

      return {
        financialDatasets: fdResponse.data,
        alphaVantage: avData,
      };
    } catch (error) {
      console.error(`Error fetching price for ${ticker}:`, error.message);
      return null;
    }
  }

  /**
   * Get analyst estimates
   */
  async getAnalystEstimates(ticker) {
    try {
      const response = await this.financialDatasetsClient.get(
        `/analyst-estimates?ticker=${ticker}&limit=4`
      );
      return response.data;
    } catch (error) {
      console.error(`Error fetching estimates for ${ticker}:`, error.message);
      return null;
    }
  }

  /**
   * Get recent news
   */
  async getNews(ticker) {
    try {
      const response = await this.financialDatasetsClient.get(
        `/news?ticker=${ticker}&limit=10`
      );
      return response.data;
    } catch (error) {
      console.error(`Error fetching news for ${ticker}:`, error.message);
      return null;
    }
  }

  /**
   * Get earnings data
   */
  async getEarningsData(ticker) {
    try {
      // Try to get earnings from analyst estimates which includes earnings dates
      const estimates = await this.getAnalystEstimates(ticker);

      // Also try Alpha Vantage earnings calendar
      let earningsCalendar = null;
      try {
        const response = await this.alphaVantageClient.get('/query', {
          params: {
            function: 'EARNINGS_CALENDAR',
            symbol: ticker,
            apikey: this.alphaVantageApiKey,
          },
        });
        earningsCalendar = response.data;
      } catch (avError) {
        console.log('Alpha Vantage earnings fetch failed');
      }

      return {
        estimates,
        calendar: earningsCalendar,
      };
    } catch (error) {
      console.error(`Error fetching earnings for ${ticker}:`, error.message);
      return null;
    }
  }

  /**
   * Get next earnings date
   */
  async getNextEarningsDate(ticker) {
    try {
      const response = await this.alphaVantageClient.get('/query', {
        params: {
          function: 'EARNINGS_CALENDAR',
          symbol: ticker,
          horizon: '3month',
          apikey: this.alphaVantageApiKey,
        },
      });

      // Parse CSV response (Alpha Vantage returns CSV)
      const lines = response.data.split('\n');
      if (lines.length > 1) {
        const data = lines[1].split(',');
        return data[2]; // reportDate is typically the 3rd column
      }
      return null;
    } catch (error) {
      console.error(`Error fetching earnings date for ${ticker}:`, error.message);
      return null;
    }
  }

  /**
   * Search web for recent developments
   */
  async searchWeb(ticker, companyName) {
    try {
      const query = `${companyName || ticker} stock recent news developments 2026`;

      const response = await this.tavilyClient.post('/search', {
        api_key: this.tavilyApiKey,
        query,
        search_depth: 'basic',
        max_results: 5,
      });

      return response.data;
    } catch (error) {
      console.error(`Error searching web for ${ticker}:`, error.message);
      return null;
    }
  }

  /**
   * Generate analysis using OpenRouter (Claude Sonnet 4.5)
   */
  async generateAnalysis(dataPackage, mode) {
    const prompt = this.buildAnalysisPrompt(dataPackage, mode);

    try {
      const response = await this.openRouterClient.post('/chat/completions', {
        model: 'anthropic/claude-sonnet-4-5:beta',
        messages: [
          {
            role: 'system',
            content: this.getHedgeFundAnalystSystemPrompt(mode),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      });

      const analysisText = response.data.choices[0].message.content;

      // Parse the structured analysis
      return this.parseAnalysis(analysisText, mode);
    } catch (error) {
      console.error('Error generating analysis:', error.message);
      throw new Error('Failed to generate analysis');
    }
  }

  /**
   * Get the hedge fund analyst system prompt
   */
  getHedgeFundAnalystSystemPrompt(mode) {
    return `You are a hedge fund equity analyst producing research for a portfolio manager.

**Current Mode: ${mode.toUpperCase()}**

${mode === 'preview' ? `
**EARNINGS PREVIEW MODE**
The company is reporting earnings within 7 days. Focus on:
- Consensus expectations vs company guidance
- Key swing factors and risks
- What could surprise the market
- Forward valuation setup
` : mode === 'review' ? `
**EARNINGS REVIEW MODE**
The company just reported earnings. Focus on:
- Actual results vs expectations (beat/miss/inline)
- New guidance vs Street expectations
- Management tone and call highlights
- Updated forward outlook
` : `
**COMPANY DEEP DIVE MODE**
Perform a comprehensive analysis:
- Business model and competitive position
- AI exposure and strategic initiatives
- Financial quality and trajectory
- Valuation across multiple frameworks
- Catalysts, risks, and investment thesis
`}

**Style Guidelines:**
- Use Australian English spelling and metric units
- Use finance shorthand: $3.4b, +17% YoY, 22x NTM P/E
- Lead with numbers, direction, and significance
- Be concise - 2-3 page equivalent maximum
- Cite sources and flag missing data as "Not disclosed"
- Stay forward-looking and valuation-driven

**Valuation Framework:**
- Use forward multiples (NTM and FY+1)
- DCF with WACC 9-10%, terminal growth 2-3%
- Compare to peers on growth and quality
- Focus on EPS trajectory and margin trends

**Output Structure:**
Provide analysis in clear sections with markdown formatting:
1. Executive Summary (3-4 key points)
2. Financial Snapshot (recent results and metrics)
3. Forward Outlook (guidance, estimates, trajectory)
4. Valuation Analysis (multiples, DCF, peer comparison)
5. Key Risks & Catalysts
6. Investment Thesis (2-3 paragraphs maximum)

Be decisive, data-driven, and actionable.`;
  }

  /**
   * Build the analysis prompt with financial data
   */
  buildAnalysisPrompt(dataPackage, mode) {
    const { ticker, overview, financials, metrics, priceData, estimates, news, webContext } = dataPackage;

    let prompt = `Analyze ${ticker} (${overview?.name || 'company name not available'}).\n\n`;

    // Add financial data
    if (metrics?.financial_metrics && metrics.financial_metrics.length > 0) {
      prompt += `**Current Metrics:**\n`;
      const latest = metrics.financial_metrics[0];
      prompt += `- Market Cap: $${(latest.market_cap / 1e9).toFixed(2)}b\n`;
      prompt += `- P/E Ratio: ${latest.price_to_earnings_ratio?.toFixed(2) || 'N/A'}\n`;
      prompt += `- EPS (TTM): $${latest.earnings_per_share?.toFixed(2) || 'N/A'}\n`;
      prompt += `- Revenue (TTM): $${(latest.revenue / 1e9).toFixed(2)}b\n`;
      prompt += `- Gross Margin: ${(latest.gross_profit_margin * 100)?.toFixed(1)}%\n`;
      prompt += `- Operating Margin: ${(latest.operating_income_margin * 100)?.toFixed(1)}%\n`;
      prompt += `- Net Margin: ${(latest.net_profit_margin * 100)?.toFixed(1)}%\n\n`;
    }

    // Add price data
    if (priceData?.financialDatasets) {
      const price = priceData.financialDatasets;
      prompt += `**Current Price:** $${price.price?.toFixed(2)}\n`;
      prompt += `**52-Week Range:** $${price.fifty_two_week_low?.toFixed(2)} - $${price.fifty_two_week_high?.toFixed(2)}\n\n`;
    }

    // Add financial statements summary
    if (financials?.financial_statements && financials.financial_statements.length > 0) {
      prompt += `**Recent Quarterly Results (Last 4 Quarters):**\n`;
      financials.financial_statements.slice(0, 4).forEach((stmt, i) => {
        prompt += `Q${4-i}: Revenue $${(stmt.income_statement?.revenue / 1e9)?.toFixed(2)}b, `;
        prompt += `Net Income $${(stmt.income_statement?.net_income / 1e9)?.toFixed(2)}b, `;
        prompt += `EPS $${stmt.income_statement?.earnings_per_share?.toFixed(2)}\n`;
      });
      prompt += `\n`;
    }

    // Add analyst estimates
    if (estimates?.estimates && estimates.estimates.length > 0) {
      prompt += `**Analyst Consensus:**\n`;
      estimates.estimates.slice(0, 2).forEach(est => {
        prompt += `${est.period_ending}: EPS est. $${est.eps_estimate?.toFixed(2)}, Revenue est. $${(est.revenue_estimate / 1e9)?.toFixed(2)}b\n`;
      });
      prompt += `\n`;
    }

    // Add recent news headlines
    if (news?.news && news.news.length > 0) {
      prompt += `**Recent News (Last 7 Days):**\n`;
      news.news.slice(0, 5).forEach(article => {
        prompt += `- ${article.headline} (${new Date(article.date).toLocaleDateString()})\n`;
      });
      prompt += `\n`;
    }

    // Add web context
    if (webContext?.results && webContext.results.length > 0) {
      prompt += `**Recent Web Search Results:**\n`;
      webContext.results.forEach(result => {
        prompt += `- ${result.title}: ${result.content.substring(0, 200)}...\n`;
      });
      prompt += `\n`;
    }

    prompt += `\nProvide a comprehensive ${mode} analysis following the hedge fund analyst format. Include specific numbers, forward outlook, and valuation perspective.`;

    return prompt;
  }

  /**
   * Parse the LLM analysis response
   */
  parseAnalysis(analysisText, mode) {
    // Extract sections using markdown headers
    const sections = {};

    const sectionRegex = /##?\s+(.+?)\n([\s\S]+?)(?=\n##?\s+|$)/g;
    let match;

    while ((match = sectionRegex.exec(analysisText)) !== null) {
      const title = match[1].trim();
      const content = match[2].trim();
      sections[title.toLowerCase().replace(/\s+/g, '_')] = content;
    }

    return {
      fullText: analysisText,
      sections,
      mode,
    };
  }

  /**
   * Generate Buy/Hold/Sell recommendation
   */
  async generateRecommendation(dataPackage, analysis) {
    const prompt = `Based on the following analysis, provide a clear investment recommendation.

**Analysis Summary:**
${analysis.fullText.substring(0, 2000)}

**Financial Metrics:**
${JSON.stringify(dataPackage.metrics?.financial_metrics?.[0], null, 2).substring(0, 1000)}

**Price Data:**
Current: $${dataPackage.priceData?.financialDatasets?.price}
52W High: $${dataPackage.priceData?.financialDatasets?.fifty_two_week_high}
52W Low: $${dataPackage.priceData?.financialDatasets?.fifty_two_week_low}

Provide your recommendation in this exact JSON format:
{
  "action": "BUY" | "HOLD" | "SELL",
  "confidence": <number 0-100>,
  "targetPrice": <number>,
  "upside": <percentage as number>,
  "reasoning": "<2-3 sentence explanation>",
  "timeHorizon": "short" | "medium" | "long",
  "keyRisks": ["<risk1>", "<risk2>", "<risk3>"]
}`;

    try {
      const response = await this.openRouterClient.post('/chat/completions', {
        model: 'anthropic/claude-sonnet-4-5:beta',
        messages: [
          {
            role: 'system',
            content: 'You are a hedge fund analyst. Provide clear, decisive investment recommendations based on valuation, growth, and risk factors. Output valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 500,
      });

      const recommendationText = response.data.choices[0].message.content;

      // Extract JSON from response
      const jsonMatch = recommendationText.match(/\{[\s\S]+\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error('Failed to parse recommendation');
    } catch (error) {
      console.error('Error generating recommendation:', error.message);

      // Fallback recommendation based on simple metrics
      return this.generateFallbackRecommendation(dataPackage);
    }
  }

  /**
   * Generate fallback recommendation if AI fails
   */
  generateFallbackRecommendation(dataPackage) {
    const metrics = dataPackage.metrics?.financial_metrics?.[0];
    const price = dataPackage.priceData?.financialDatasets?.price;

    if (!metrics || !price) {
      return {
        action: 'HOLD',
        confidence: 50,
        targetPrice: price || 0,
        upside: 0,
        reasoning: 'Insufficient data for recommendation. Further analysis required.',
        timeHorizon: 'medium',
        keyRisks: ['Data availability', 'Market volatility'],
      };
    }

    // Simple valuation-based logic
    const pe = metrics.price_to_earnings_ratio;
    const fiftyTwoWeekHigh = dataPackage.priceData?.financialDatasets?.fifty_two_week_high;
    const fiftyTwoWeekLow = dataPackage.priceData?.financialDatasets?.fifty_two_week_low;

    const priceVsHigh = ((fiftyTwoWeekHigh - price) / price) * 100;
    const priceVsLow = ((price - fiftyTwoWeekLow) / fiftyTwoWeekLow) * 100;

    let action = 'HOLD';
    let confidence = 60;
    let targetPrice = price;
    let reasoning = 'Hold position based on current valuation metrics.';

    if (pe < 20 && priceVsHigh > 20) {
      action = 'BUY';
      confidence = 75;
      targetPrice = price * 1.15;
      reasoning = 'Attractive valuation with room to run towards 52-week high. P/E suggests undervaluation.';
    } else if (pe > 35 && priceVsLow > 50) {
      action = 'SELL';
      confidence = 70;
      targetPrice = price * 0.9;
      reasoning = 'Extended valuation with significant gains from lows. Consider taking profits.';
    } else if (priceVsHigh < 5) {
      action = 'HOLD';
      confidence = 65;
      targetPrice = price;
      reasoning = 'Trading near 52-week highs. Wait for better entry or pullback.';
    }

    const upside = ((targetPrice - price) / price) * 100;

    return {
      action,
      confidence,
      targetPrice: Math.round(targetPrice * 100) / 100,
      upside: Math.round(upside * 10) / 10,
      reasoning,
      timeHorizon: 'medium',
      keyRisks: ['Market volatility', 'Sector headwinds', 'Execution risk'],
    };
  }

  /**
   * Batch analyze multiple tickers
   */
  async analyzeBatch(tickers, mode = null) {
    const results = [];

    // Process in batches of 3 to avoid rate limits
    const batchSize = 3;
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(ticker =>
          this.analyzeCompany(ticker, mode).catch(error => ({
            ticker,
            error: error.message,
            timestamp: new Date().toISOString(),
          }))
        )
      );
      results.push(...batchResults);

      // Wait 1 second between batches to respect rate limits
      if (i + batchSize < tickers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}

module.exports = FundamentalAnalysisService;
