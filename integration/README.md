# Laserbeam Capital - Fundamental Analysis Integration

AI-powered hedge fund equity research for your portfolio dashboard.

## 🎯 What This Does

Transforms any ticker into a comprehensive investment report with:

- **Hedge Fund-Style Analysis** - Professional equity research format
- **AI-Powered Insights** - Uses Claude Sonnet 4.5 via OpenRouter
- **Real Financial Data** - Financial Datasets, Alpha Vantage, Tavily
- **Clear Recommendations** - BUY / HOLD / SELL with target prices
- **Earnings Intelligence** - Auto-adjusts analysis based on earnings timing

## 📁 Files Included

```
integration/
├── backend/
│   ├── fundamental-analysis.routes.js    # Express routes
│   ├── fundamental-analysis.service.js   # Core analysis engine
│   └── package.json                       # Dependencies
│
├── frontend/
│   ├── FundamentalAnalysis.jsx           # React component
│   ├── FundamentalAnalysis.css           # Styling (matches your theme)
│   ├── Portfolio-Example.jsx             # Integration example
│   └── package.json                       # Dependencies
│
├── INTEGRATION_GUIDE.md                   # Complete documentation
├── QUICK_START.md                         # 5-minute setup guide
└── README.md                              # This file
```

## 🚀 Quick Start

### Step 1: Backend (2 minutes)

```bash
# Copy files to laserbeamnode
cp backend/fundamental-analysis.routes.js ../laserbeamnode/routes/
cp backend/fundamental-analysis.service.js ../laserbeamnode/services/

# Install dependency
cd ../laserbeamnode && npm install axios
```

Add to `server.js`:
```javascript
const fundamentalAnalysisRoutes = require('./routes/fundamental-analysis.routes');
app.use('/api/fundamental-analysis', fundamentalAnalysisRoutes);
```

### Step 2: Frontend (2 minutes)

```bash
# Copy files to laserbeam
cp frontend/FundamentalAnalysis.jsx ../laserbeam/src/components/
cp frontend/FundamentalAnalysis.css ../laserbeam/src/components/

# Install dependency
cd ../laserbeam && npm install axios
```

Add to your Portfolio page:
```javascript
import FundamentalAnalysis from './components/FundamentalAnalysis';

function Portfolio() {
  const tickers = ['AAPL', 'GOOGL']; // Your portfolio tickers

  return (
    <div>
      {/* Your existing portfolio code */}
      <FundamentalAnalysis portfolioTickers={tickers} />
    </div>
  );
}
```

### Step 3: Test (1 minute)

1. Restart backend and frontend
2. Navigate to portfolio page
3. Enter "AAPL" and click "Analyze"
4. Wait 15-30 seconds for comprehensive analysis
5. See BUY/HOLD/SELL recommendation! ✅

## 📊 Features

### 3 Analysis Modes (Auto-Detected)

1. **Earnings Preview** - When earnings are within 7 days
   - Consensus expectations
   - Key swing factors
   - What could surprise

2. **Earnings Review** - Within 7 days after earnings
   - Beat/miss analysis
   - New guidance assessment
   - Updated outlook

3. **Deep Dive** - All other times (default)
   - Business model analysis
   - Competitive positioning
   - AI exposure and strategy
   - Multi-framework valuation
   - Investment thesis

### Data Sources

✅ **Financial Datasets AI** - Income statements, balance sheets, cash flow, metrics
✅ **Alpha Vantage** - Real-time prices, earnings calendar
✅ **Tavily** - Recent news and developments
✅ **OpenRouter** - Claude Sonnet 4.5 AI analysis

### Recommendation System

**BUY** - Strong fundamentals, attractive valuation, positive catalysts
**HOLD** - Fair value, balanced risk/reward, wait for better entry
**SELL** - Overvalued, deteriorating fundamentals, negative outlook

Each recommendation includes:
- Confidence score (0-100%)
- Target price
- Upside/downside %
- Time horizon (short/medium/long)
- Key risks

## 🎨 UI Preview

```
┌─────────────────────────────────────────────────────────┐
│  FUNDAMENTAL ANALYSIS                                    │
│  AI-powered equity research using hedge fund methodology │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  [  Enter ticker (e.g., AAPL)  ] [Auto Mode ▼] [Analyze]│
│                                                           │
│  Analyze portfolio holdings:                             │
│  [ AAPL ] [ GOOGL ] [ MSFT ] [ XOM ] [ RDDT ] ...       │
│                                                           │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  AAPL  Apple Inc.                        [DEEP-DIVE]    │
│                                                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │  🟢 BUY                     High Confidence (85%)  │  │
│  │                                                     │  │
│  │  Target: $185.50  |  Upside: +12.5%  |  Medium    │  │
│  │                                                     │  │
│  │  Investment Thesis:                                │  │
│  │  Strong fundamentals with AI-driven growth...      │  │
│  │                                                     │  │
│  │  Key Risks:                                        │  │
│  │  • Regulatory scrutiny                             │  │
│  │  • China exposure                                  │  │
│  └───────────────────────────────────────────────────┘  │
│                                                           │
│  ## Executive Summary                                    │
│  • Revenue growth accelerating at 8% YoY...            │
│  • Margins expanding driven by services mix...          │
│  • Valuation attractive at 22x NTM P/E vs peers 28x... │
│                                                           │
│  ## Financial Snapshot                                   │
│  [Detailed financial data...]                            │
│                                                           │
│  [🔄 Refresh] [Clear]                                   │
└─────────────────────────────────────────────────────────┘
```

## 💰 Cost Estimate

~$0.12 per ticker analysis

**Monthly estimates:**
- 10 analyses/day = $37.50/month
- 50 analyses/day = $187.50/month

Breakdown:
- Financial Datasets: $0.06
- Tavily: $0.005
- OpenRouter (Claude): $0.06

## 🔐 Security

All API keys stored as environment variables on your backend:

```bash
FINANCIAL_DATASETS_API=your_key
TAVILY_API_KEY=your_key
OPENROUTER=your_key
ALPHA_VANTAGE_API_KEY=your_key
DATABENTO_FUTURESPRICES=your_key
```

✅ Already configured on your system

## 📚 Documentation

- **`QUICK_START.md`** - 5-minute setup (start here!)
- **`INTEGRATION_GUIDE.md`** - Complete documentation with troubleshooting
- **`Portfolio-Example.jsx`** - Full integration example

## 🛠️ API Endpoints

```
POST /api/fundamental-analysis/analyze
  → Single ticker analysis

POST /api/fundamental-analysis/batch
  → Multiple tickers (portfolio-wide)

GET /api/fundamental-analysis/earnings-calendar/:ticker
  → Upcoming earnings date
```

## 🎯 Use Cases

1. **Before Portfolio Review Meeting**
   - Analyze all holdings with one click
   - Get buy/hold/sell recommendations
   - Identify trim candidates

2. **Researching New Ideas**
   - Deep dive on potential additions
   - Compare against portfolio holdings
   - Validate thesis with AI analysis

3. **Earnings Season**
   - Auto-switches to preview mode
   - Highlights key factors to watch
   - Post-earnings review with updated outlook

4. **Client Reporting**
   - Professional research format
   - Clear recommendations
   - Comprehensive but concise

## 🔧 Customization

### Change AI Model

```javascript
// In fundamental-analysis.service.js
model: 'anthropic/claude-opus-4-5:beta'  // More powerful
model: 'openai/gpt-4-turbo'              // Alternative
```

### Adjust Colors

```css
/* In FundamentalAnalysis.css */
--color-buy: #10b981;    /* Green */
--color-sell: #ef4444;   /* Red */
--color-hold: #f59e0b;   /* Amber */
```

### Modify Recommendation Logic

```javascript
// In generateFallbackRecommendation()
if (pe < 15 && priceVsHigh > 30) {
  action = 'BUY';
}
```

## 📈 Performance

- **Single analysis**: 15-30 seconds
- **Batch (5 tickers)**: 30-60 seconds
- **Rate limiting**: 3 concurrent, 1s between batches

## 🐛 Troubleshooting

**CORS Error?**
```javascript
// server.js
app.use(cors({ origin: 'https://www.laserbeamcapital.com' }));
```

**API Key Error?**
```bash
echo $OPENROUTER  # Verify keys are set
```

**Slow Response?**
```javascript
// Implement caching (future enhancement)
// 1-hour cache reduces repeat costs by 90%
```

## 🚧 Future Enhancements

- [ ] Real-time streaming analysis
- [ ] Historical analysis archive
- [ ] Portfolio-level insights dashboard
- [ ] Email alerts on recommendation changes
- [ ] Side-by-side comparison view
- [ ] PDF export for client reports

## 📄 License

MIT

---

## Questions?

See `INTEGRATION_GUIDE.md` for comprehensive documentation, or review the example files for implementation patterns.

Built with ❤️ for Laserbeam Capital
