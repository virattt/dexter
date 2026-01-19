# Fundamental Analysis Integration Guide

## Overview

This guide will help you integrate the AI-powered Fundamental Analysis feature into your Laserbeam Capital dashboard. The system uses your existing APIs (Financial Datasets, Tavily, OpenRouter, Alpha Vantage, Databento) to generate hedge fund-style equity research with Buy/Hold/Sell recommendations.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React/Vite)                    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │        FundamentalAnalysis.jsx Component              │   │
│  │  • Ticker Input                                        │   │
│  │  • Mode Selection (Auto/Deep-Dive/Preview/Review)     │   │
│  │  • Portfolio Holdings Quick Access                    │   │
│  │  • Analysis Display                                    │   │
│  │  • Buy/Hold/Sell Recommendation Card                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                   │
│                           │ HTTPS POST                        │
│                           ▼                                   │
└─────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────┐
│                Backend (Node.js/Express)                     │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │    /api/fundamental-analysis Routes                   │   │
│  │  POST /analyze - Single ticker analysis               │   │
│  │  POST /batch - Multiple tickers                       │   │
│  │  GET /earnings-calendar/:ticker                       │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                         │
│                     ▼                                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │    FundamentalAnalysisService                         │   │
│  │  • Data orchestration                                  │   │
│  │  • AI analysis generation                             │   │
│  │  • Recommendation logic                               │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                         │
└─────────────────────┼─────────────────────────────────────────┘
                      │
        ┌─────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌──────────────────┐    ┌──────────────────────────┐
│  External APIs   │    │     AI/LLM Service       │
│                  │    │                          │
│ • Financial      │    │ • OpenRouter             │
│   Datasets AI    │    │ • Claude Sonnet 4.5      │
│ • Alpha Vantage  │    │   (Hedge Fund Analyst)   │
│ • Tavily Search  │    │                          │
│ • Databento      │    │                          │
└──────────────────┘    └──────────────────────────┘
```

---

## Installation Steps

### 1. Backend Integration (laserbeamnode)

#### Step 1.1: Copy Backend Files

Copy these files to your `laserbeamnode` repository:

```bash
# From integration/backend/ to your laserbeamnode repo:

integration/backend/fundamental-analysis.routes.js
  → laserbeamnode/routes/fundamental-analysis.routes.js

integration/backend/fundamental-analysis.service.js
  → laserbeamnode/services/fundamental-analysis.service.js
```

#### Step 1.2: Install Required Dependencies

```bash
cd laserbeamnode
npm install axios
```

#### Step 1.3: Register Routes

Add to your main server file (`server.js`, `app.js`, or `index.js`):

```javascript
// Import the routes
const fundamentalAnalysisRoutes = require('./routes/fundamental-analysis.routes');

// Register the routes (add this with your other route registrations)
app.use('/api/fundamental-analysis', fundamentalAnalysisRoutes);
```

Example full server setup:

```javascript
const express = require('express');
const cors = require('cors');
const fundamentalAnalysisRoutes = require('./routes/fundamental-analysis.routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/fundamental-analysis', fundamentalAnalysisRoutes);
// ... your other routes

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

#### Step 1.4: Verify Environment Variables

Ensure these environment variables are set in your backend (you mentioned they're already configured):

```bash
FINANCIAL_DATASETS_API=your_api_key
TAVILY_API_KEY=your_api_key
OPENROUTER=your_api_key
ALPHA_VANTAGE_API_KEY=your_api_key
DATABENTO_FUTURESPRICES=your_api_key
```

---

### 2. Frontend Integration (laserbeam)

#### Step 2.1: Copy Frontend Files

Copy these files to your `laserbeam` repository:

```bash
# From integration/frontend/ to your laserbeam repo:

integration/frontend/FundamentalAnalysis.jsx
  → laserbeam/src/components/FundamentalAnalysis.jsx

integration/frontend/FundamentalAnalysis.css
  → laserbeam/src/components/FundamentalAnalysis.css
```

#### Step 2.2: Set API URL

Create or update your `.env` file in the laserbeam frontend:

```bash
# laserbeam/.env
VITE_API_URL=https://api.laserbeamcapital.com
```

#### Step 2.3: Install Axios (if not already installed)

```bash
cd laserbeam
npm install axios
```

---

### 3. Integration with Portfolio Page

There are two approaches to integrate the fundamental analysis into your portfolio dashboard:

#### Option A: Separate Route/Page (Recommended)

Add a new route in your React app:

```javascript
// In your router file (e.g., App.jsx or routes.jsx)
import FundamentalAnalysis from './components/FundamentalAnalysis';

// Add route
<Route path="/dashboard/analysis" element={<FundamentalAnalysis />} />
```

Then add a navigation link in your dashboard:

```javascript
<Link to="/dashboard/analysis">Fundamental Analysis</Link>
```

#### Option B: Below Portfolio Section (As Requested)

Integrate directly into your portfolio/dashboard page:

```javascript
// In your Portfolio.jsx or Dashboard.jsx file
import FundamentalAnalysis from '../components/FundamentalAnalysis';

function Portfolio() {
  // Your existing portfolio state
  const [portfolioData, setPortfolioData] = useState(null);

  // Extract tickers from portfolio
  const portfolioTickers = portfolioData?.positions?.map(p => p.ticker) || [];

  return (
    <div className="portfolio-page">
      {/* Your existing portfolio section */}
      <div className="portfolio-header">
        <h1>PORTFOLIO</h1>
        {/* ... your portfolio summary cards ... */}
      </div>

      <div className="portfolio-table">
        {/* ... your existing portfolio table ... */}
      </div>

      {/* NEW: Fundamental Analysis Section */}
      <div className="analysis-section">
        <FundamentalAnalysis portfolioTickers={portfolioTickers} />
      </div>
    </div>
  );
}
```

Add spacing CSS to your portfolio stylesheet:

```css
.analysis-section {
  margin-top: 48px;
  padding-top: 48px;
  border-top: 1px solid #2a2a2a;
}
```

---

## API Endpoints

### POST `/api/fundamental-analysis/analyze`

Analyze a single ticker.

**Request:**
```json
{
  "ticker": "AAPL",
  "mode": "auto",  // "auto" | "deep-dive" | "preview" | "review"
  "includePortfolioContext": false
}
```

**Response:**
```json
{
  "ticker": "AAPL",
  "company": "Apple Inc.",
  "mode": "deep-dive",
  "analysis": {
    "fullText": "## Executive Summary\n...",
    "sections": { ... }
  },
  "recommendation": {
    "action": "BUY",
    "confidence": 85,
    "targetPrice": 185.50,
    "upside": 12.5,
    "reasoning": "Strong fundamentals with AI-driven growth...",
    "timeHorizon": "medium",
    "keyRisks": ["Regulatory scrutiny", "China exposure"]
  },
  "timestamp": "2026-01-19T10:30:00.000Z"
}
```

### POST `/api/fundamental-analysis/batch`

Analyze multiple tickers (for entire portfolio).

**Request:**
```json
{
  "tickers": ["AAPL", "GOOGL", "MSFT"],
  "mode": "auto"
}
```

**Response:**
```json
{
  "results": [
    { /* analysis object 1 */ },
    { /* analysis object 2 */ },
    { /* analysis object 3 */ }
  ],
  "summary": {
    "totalBuys": 2,
    "totalHolds": 1,
    "totalSells": 0,
    "portfolioScore": 78.3
  }
}
```

### GET `/api/fundamental-analysis/earnings-calendar/:ticker`

Get upcoming earnings date.

**Response:**
```json
{
  "ticker": "AAPL",
  "nextEarningsDate": "2026-01-28",
  "daysUntil": 9
}
```

---

## Analysis Modes

The system automatically selects the appropriate analysis mode based on earnings timing:

### 1. **Earnings Preview** (Auto-selected when earnings within 7 days)
- Consensus expectations vs guidance
- Key swing factors
- What could surprise
- Forward valuation setup

### 2. **Earnings Review** (Auto-selected within 7 days after earnings)
- Actual results vs expectations
- New guidance analysis
- Management tone assessment
- Updated outlook

### 3. **Deep Dive** (Default for all other times)
- Comprehensive business analysis
- Competitive positioning
- AI exposure and strategy
- Multi-framework valuation
- Investment thesis

---

## Customization

### Changing the AI Model

Edit `fundamental-analysis.service.js`:

```javascript
// In generateAnalysis() method
const response = await this.openRouterClient.post('/chat/completions', {
  model: 'anthropic/claude-sonnet-4-5:beta',  // Change model here
  // Options:
  // - 'anthropic/claude-opus-4-5:beta' (more powerful, slower, expensive)
  // - 'openai/gpt-4-turbo' (OpenAI alternative)
  // - 'google/gemini-pro-1.5' (Google alternative)
  ...
});
```

### Adjusting Recommendation Thresholds

Edit the `generateFallbackRecommendation()` method in `fundamental-analysis.service.js`:

```javascript
// Example: Make BUY threshold more conservative
if (pe < 15 && priceVsHigh > 30) {  // Changed from 20 to 15 and 20 to 30
  action = 'BUY';
  ...
}
```

### Styling Customization

All colors and dimensions can be adjusted in `FundamentalAnalysis.css`. Key variables:

```css
/* Background colors */
--bg-primary: #0a0a0a;
--bg-secondary: #1a1a1a;
--bg-tertiary: #2a2a2a;

/* Action colors */
--color-buy: #10b981;    /* Green */
--color-sell: #ef4444;   /* Red */
--color-hold: #f59e0b;   /* Amber */

/* Accent color */
--color-accent: #3b82f6; /* Blue */
```

---

## Testing

### 1. Test Backend Endpoints

```bash
# Test single ticker analysis
curl -X POST http://localhost:3000/api/fundamental-analysis/analyze \
  -H "Content-Type: application/json" \
  -d '{"ticker": "AAPL", "mode": "auto"}'

# Test earnings calendar
curl http://localhost:3000/api/fundamental-analysis/earnings-calendar/AAPL
```

### 2. Test Frontend Component

1. Navigate to the analysis page/section
2. Enter a ticker (e.g., "AAPL")
3. Click "Analyze"
4. Verify:
   - Loading spinner appears
   - Analysis renders after 15-30 seconds
   - Recommendation card shows BUY/HOLD/SELL
   - All sections display correctly
   - Styling matches portfolio theme

### 3. Test Portfolio Integration

1. Navigate to portfolio page
2. Click on a portfolio ticker chip
3. Verify analysis loads for that ticker
4. Test multiple holdings

---

## Performance Considerations

### API Rate Limits

The service includes rate limiting for batch operations:
- Processes 3 tickers at a time
- 1-second delay between batches
- Prevents API overuse

### Caching (Optional Future Enhancement)

To reduce costs and improve speed, consider adding Redis caching:

```javascript
// Example caching layer (not implemented yet)
const cacheKey = `analysis:${ticker}:${mode}:${date}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// ... run analysis ...

await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600); // 1 hour cache
```

### Expected Response Times

- Single ticker analysis: **15-30 seconds**
- Batch of 5 tickers: **30-60 seconds**
- Earnings calendar lookup: **1-2 seconds**

---

## Troubleshooting

### Issue: "Analysis failed" error

**Causes:**
1. Missing API keys
2. API rate limits exceeded
3. Invalid ticker symbol

**Solutions:**
```bash
# Check environment variables
echo $FINANCIAL_DATASETS_API
echo $OPENROUTER

# Check API key validity
curl -H "X-API-KEY: $FINANCIAL_DATASETS_API" \
  https://api.financialdatasets.ai/prices/snapshot?ticker=AAPL

# Try different ticker
```

### Issue: Recommendation shows "HOLD" for all tickers

**Cause:** Fallback logic is being used (AI recommendation failed)

**Solutions:**
1. Check OpenRouter API key
2. Verify model availability
3. Check OpenRouter console for errors
4. Review generateRecommendation() method logs

### Issue: Frontend can't connect to backend

**Causes:**
1. CORS not configured
2. Wrong API URL
3. Backend not running

**Solutions:**
```javascript
// In backend server.js, ensure CORS is enabled:
app.use(cors({
  origin: ['http://localhost:5173', 'https://www.laserbeamcapital.com'],
  credentials: true
}));

// In frontend .env:
VITE_API_URL=https://api.laserbeamcapital.com  // No trailing slash
```

### Issue: Styling doesn't match portfolio page

**Solution:**
1. Inspect portfolio page CSS variables
2. Update FundamentalAnalysis.css color scheme
3. Ensure same font family is used

---

## Security Considerations

### API Key Protection

✅ **DO:**
- Store API keys in environment variables only
- Never commit `.env` files
- Use `.gitignore` to exclude sensitive files
- Rotate API keys periodically

❌ **DON'T:**
- Expose API keys in frontend code
- Log API keys in console
- Include keys in error messages

### Input Validation

The backend validates:
- Ticker format (alphanumeric, max 5 chars)
- Mode selection (enum)
- Request rate limiting (optional, implement as needed)

---

## Future Enhancements

### 1. Real-time Streaming Analysis
Stream analysis results as they're generated:

```javascript
// Backend: Use Server-Sent Events (SSE)
router.get('/analyze-stream/:ticker', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  // Stream chunks as they arrive from OpenRouter
});

// Frontend: Use EventSource API
const eventSource = new EventSource(`${API_URL}/api/fundamental-analysis/analyze-stream/${ticker}`);
eventSource.onmessage = (event) => {
  // Update UI with streaming text
};
```

### 2. Historical Analysis Archive
Store past analyses in database:

```sql
CREATE TABLE fundamental_analyses (
  id SERIAL PRIMARY KEY,
  ticker VARCHAR(10),
  analysis_mode VARCHAR(20),
  recommendation VARCHAR(10),
  target_price DECIMAL,
  full_analysis TEXT,
  created_at TIMESTAMP
);
```

### 3. Portfolio-Level Insights
Aggregate recommendations across entire portfolio:

```javascript
// POST /api/fundamental-analysis/portfolio-summary
// Returns: sector allocation, risk score, top picks, trim candidates
```

### 4. Alerts & Notifications
Email/SMS when recommendations change:

```javascript
// Monitor daily, send alerts if:
// - BUY changes to SELL
// - Target price changes > 10%
// - Earnings upcoming for portfolio holdings
```

### 5. Comparison View
Side-by-side analysis of 2-3 tickers:

```javascript
<FundamentalAnalysisComparison tickers={['AAPL', 'GOOGL', 'MSFT']} />
```

---

## Cost Estimation

### Per Analysis Cost (Approximate)

| Service | Cost per Call | Calls per Analysis | Total |
|---------|---------------|-------------------|-------|
| Financial Datasets | $0.01 | 6 | $0.06 |
| Alpha Vantage | Free (75/day) | 2 | $0.00 |
| Tavily Search | $0.005 | 1 | $0.005 |
| OpenRouter (Claude) | $0.03 | 2 | $0.06 |
| **TOTAL** | | | **~$0.125** |

**Monthly estimates:**
- 10 analyses/day = **$37.50/month**
- 50 analyses/day = **$187.50/month**
- 100 analyses/day = **$375/month**

**Optimization tips:**
- Cache results for 1-24 hours
- Use batch endpoints when possible
- Use cheaper models for preview/review modes
- Implement daily API budget limits

---

## Support & Maintenance

### Logging

Add structured logging for debugging:

```javascript
// In fundamental-analysis.service.js
const logger = require('./logger'); // Your logger

logger.info('Starting analysis', { ticker, mode });
logger.error('Analysis failed', { ticker, error: error.message });
```

### Monitoring

Track key metrics:
- API response times
- Error rates by endpoint
- API costs by ticker
- Recommendation distribution (BUY/HOLD/SELL ratio)

### Version Control

Tag releases:

```bash
git tag -a v1.0.0 -m "Initial fundamental analysis release"
git push origin v1.0.0
```

---

## Questions?

If you encounter issues during integration:

1. Check the troubleshooting section above
2. Review backend logs for API errors
3. Inspect frontend console for network errors
4. Verify all environment variables are set
5. Test each API individually

---

## Summary Checklist

### Backend ✓
- [ ] Copy `fundamental-analysis.routes.js` to `laserbeamnode/routes/`
- [ ] Copy `fundamental-analysis.service.js` to `laserbeamnode/services/`
- [ ] Install dependencies (`npm install axios`)
- [ ] Register routes in main server file
- [ ] Verify environment variables are set
- [ ] Test API endpoints with curl

### Frontend ✓
- [ ] Copy `FundamentalAnalysis.jsx` to `laserbeam/src/components/`
- [ ] Copy `FundamentalAnalysis.css` to `laserbeam/src/components/`
- [ ] Set `VITE_API_URL` in `.env`
- [ ] Install axios (`npm install axios`)
- [ ] Import and render component in portfolio/dashboard page
- [ ] Pass portfolio tickers as prop
- [ ] Test in browser

### Deployment ✓
- [ ] Push backend changes to production
- [ ] Push frontend changes to production
- [ ] Verify CORS is configured for production domain
- [ ] Test on production environment
- [ ] Monitor API costs and usage

---

**You're all set!** 🚀

The fundamental analysis feature is now ready to help you make data-driven investment decisions with hedge fund-quality research.
