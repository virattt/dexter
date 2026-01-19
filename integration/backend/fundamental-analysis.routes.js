/**
 * Fundamental Analysis API Routes for Laserbeam Capital
 *
 * Place this file in: laserbeamnode/routes/fundamental-analysis.routes.js
 *
 * Add to your main server file (app.js or server.js):
 * const fundamentalAnalysisRoutes = require('./routes/fundamental-analysis.routes');
 * app.use('/api/fundamental-analysis', fundamentalAnalysisRoutes);
 */

const express = require('express');
const router = express.Router();
const FundamentalAnalysisService = require('../services/fundamental-analysis.service');

/**
 * POST /api/fundamental-analysis/analyze
 *
 * Analyze a ticker with hedge fund analyst format
 *
 * Body: {
 *   ticker: string (e.g., "AAPL", "GOOGL")
 *   mode?: "preview" | "review" | "deep-dive" (auto-detected if not provided)
 *   includePortfolioContext?: boolean (compare against portfolio holdings)
 * }
 *
 * Response: {
 *   ticker: string,
 *   company: string,
 *   mode: string,
 *   analysis: object,
 *   recommendation: {
 *     action: "BUY" | "HOLD" | "SELL",
 *     confidence: number (0-100),
 *     reasoning: string,
 *     targetPrice: number,
 *     upside: number (%)
 *   },
 *   timestamp: string
 * }
 */
router.post('/analyze', async (req, res) => {
  try {
    const { ticker, mode, includePortfolioContext } = req.body;

    if (!ticker) {
      return res.status(400).json({ error: 'Ticker is required' });
    }

    // Initialize service with API keys from environment
    const analysisService = new FundamentalAnalysisService({
      financialDatasetsApiKey: process.env.FINANCIAL_DATASETS_API,
      tavilyApiKey: process.env.TAVILY_API_KEY,
      openRouterApiKey: process.env.OPENROUTER,
      alphaVantageApiKey: process.env.ALPHA_VANTAGE_API_KEY,
      databentApiKey: process.env.DATABENTO_FUTURESPRICES,
    });

    // Run the analysis
    const result = await analysisService.analyzeCompany(
      ticker.toUpperCase(),
      mode,
      includePortfolioContext
    );

    res.json(result);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: 'Analysis failed',
      message: error.message,
      ticker: req.body.ticker,
    });
  }
});

/**
 * POST /api/fundamental-analysis/batch
 *
 * Analyze multiple tickers (for portfolio analysis)
 *
 * Body: {
 *   tickers: string[] (e.g., ["AAPL", "GOOGL", "MSFT"])
 *   mode?: string
 * }
 *
 * Response: {
 *   results: Array<analysis object>,
 *   summary: {
 *     totalBuys: number,
 *     totalHolds: number,
 *     totalSells: number,
 *     portfolioScore: number
 *   }
 * }
 */
router.post('/batch', async (req, res) => {
  try {
    const { tickers, mode } = req.body;

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return res.status(400).json({ error: 'Tickers array is required' });
    }

    const analysisService = new FundamentalAnalysisService({
      financialDatasetsApiKey: process.env.FINANCIAL_DATASETS_API,
      tavilyApiKey: process.env.TAVILY_API_KEY,
      openRouterApiKey: process.env.OPENROUTER,
      alphaVantageApiKey: process.env.ALPHA_VANTAGE_API_KEY,
      databentApiKey: process.env.DATABENTO_FUTURESPRICES,
    });

    // Run analyses in parallel with rate limiting
    const results = await analysisService.analyzeBatch(
      tickers.map(t => t.toUpperCase()),
      mode
    );

    // Generate summary
    const summary = {
      totalBuys: results.filter(r => r.recommendation.action === 'BUY').length,
      totalHolds: results.filter(r => r.recommendation.action === 'HOLD').length,
      totalSells: results.filter(r => r.recommendation.action === 'SELL').length,
      portfolioScore: results.reduce((sum, r) => sum + r.recommendation.confidence, 0) / results.length,
    };

    res.json({ results, summary });
  } catch (error) {
    console.error('Batch analysis error:', error);
    res.status(500).json({
      error: 'Batch analysis failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/fundamental-analysis/earnings-calendar/:ticker
 *
 * Get upcoming earnings date for a ticker
 */
router.get('/earnings-calendar/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;

    const analysisService = new FundamentalAnalysisService({
      financialDatasetsApiKey: process.env.FINANCIAL_DATASETS_API,
      alphaVantageApiKey: process.env.ALPHA_VANTAGE_API_KEY,
    });

    const earningsDate = await analysisService.getNextEarningsDate(ticker.toUpperCase());

    res.json({
      ticker: ticker.toUpperCase(),
      nextEarningsDate: earningsDate,
      daysUntil: earningsDate ? Math.ceil((new Date(earningsDate) - new Date()) / (1000 * 60 * 60 * 24)) : null,
    });
  } catch (error) {
    console.error('Earnings calendar error:', error);
    res.status(500).json({
      error: 'Failed to fetch earnings date',
      message: error.message,
    });
  }
});

module.exports = router;
