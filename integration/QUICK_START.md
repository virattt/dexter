# Quick Start Guide - 5 Minutes

## TL;DR

1. **Backend**: Copy 2 files → Install axios → Register routes
2. **Frontend**: Copy 2 files → Set API URL → Import component
3. **Done**: Test with "AAPL"

---

## Backend (laserbeamnode)

```bash
# 1. Copy files
cp integration/backend/fundamental-analysis.routes.js laserbeamnode/routes/
cp integration/backend/fundamental-analysis.service.js laserbeamnode/services/

# 2. Install dependencies
cd laserbeamnode
npm install axios

# 3. Register routes (add to server.js)
```

```javascript
// In laserbeamnode/server.js
const fundamentalAnalysisRoutes = require('./routes/fundamental-analysis.routes');
app.use('/api/fundamental-analysis', fundamentalAnalysisRoutes);
```

---

## Frontend (laserbeam)

```bash
# 1. Copy files
cp integration/frontend/FundamentalAnalysis.jsx laserbeam/src/components/
cp integration/frontend/FundamentalAnalysis.css laserbeam/src/components/

# 2. Set API URL
echo "VITE_API_URL=https://api.laserbeamcapital.com" >> laserbeam/.env

# 3. Install axios (if needed)
cd laserbeam
npm install axios
```

---

## Integration into Portfolio Page

```javascript
// In your Portfolio.jsx or Dashboard.jsx
import FundamentalAnalysis from '../components/FundamentalAnalysis';

function Portfolio() {
  const portfolioTickers = ['AAPL', 'GOOGL', 'MSFT']; // Your actual tickers

  return (
    <div>
      {/* Your existing portfolio code */}

      {/* Add this at the bottom */}
      <FundamentalAnalysis portfolioTickers={portfolioTickers} />
    </div>
  );
}
```

---

## Test It

1. Start backend: `npm start`
2. Start frontend: `npm run dev`
3. Navigate to portfolio page
4. Enter "AAPL" → Click "Analyze"
5. Wait 15-30 seconds
6. See recommendation! 🎉

---

## Environment Variables Required

Already configured on your backend ✅:
- `FINANCIAL_DATASETS_API`
- `TAVILY_API_KEY`
- `OPENROUTER`
- `ALPHA_VANTAGE_API_KEY`
- `DATABENTO_FUTURESPRICES`

---

## Troubleshooting

**"Analysis failed"**
```bash
# Check API keys
echo $OPENROUTER
echo $FINANCIAL_DATASETS_API
```

**CORS error**
```javascript
// Add to server.js
app.use(cors({ origin: 'https://www.laserbeamcapital.com' }));
```

**Component not rendering**
```javascript
// Check import path
import FundamentalAnalysis from '../components/FundamentalAnalysis';
// or
import FundamentalAnalysis from './components/FundamentalAnalysis';
```

---

## What It Does

✨ **Input**: Ticker symbol (e.g., AAPL)

🤖 **Processing** (15-30s):
1. Fetches financial statements (Financial Datasets)
2. Gets current prices (Alpha Vantage)
3. Searches news (Tavily)
4. AI analysis (OpenRouter/Claude)
5. Generates BUY/HOLD/SELL recommendation

📊 **Output**:
- Executive summary
- Financial analysis
- Valuation metrics
- **BUY/HOLD/SELL** with target price
- Key risks

---

## Cost Per Analysis

~$0.12 per ticker analysis

Includes:
- All API calls
- AI processing
- Comprehensive report

---

## Full Documentation

See `INTEGRATION_GUIDE.md` for complete details, customization, and advanced features.
