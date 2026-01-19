# 🚀 Deployment Guide

Three ways to deploy the Fundamental Analysis integration to your laserbeam and laserbeamnode repos.

---

## ⚡ Option 1: Ultra Quick (30 seconds)

**If your repos are at `/home/user/laserbeam` and `/home/user/laserbeamnode`:**

```bash
cd /home/user/dexter
./integration/QUICKSTART.sh
```

Then add the integration code snippets shown in the output to `server.js` and `Portfolio.jsx`.

**Done!** ✅

---

## 🎯 Option 2: Interactive Deployment (2 minutes)

**Works with any directory structure:**

```bash
cd /home/user/dexter
./integration/deploy.sh
```

The script will:
- Ask for your repo locations (if not in standard paths)
- Copy all files
- Install dependencies
- Set up `.env`
- Show you exactly what code to add

**Done!** ✅

---

## 📝 Option 3: Manual Copy (5 minutes)

**Full control over every step:**

See `MANUAL_COPY.md` for detailed commands.

Quick version:

```bash
# Backend
cp integration/backend/fundamental-analysis.routes.js ../laserbeamnode/routes/
cp integration/backend/fundamental-analysis.service.js ../laserbeamnode/services/
cd ../laserbeamnode && npm install axios

# Frontend
cp integration/frontend/FundamentalAnalysis.jsx ../laserbeam/src/components/
cp integration/frontend/FundamentalAnalysis.css ../laserbeam/src/components/
cd ../laserbeam && npm install axios
```

**Done!** ✅

---

## 🔧 Integration Code

### Backend: `server.js` or `app.js`

Add these two lines:

```javascript
const fundamentalAnalysisRoutes = require('./routes/fundamental-analysis.routes');
app.use('/api/fundamental-analysis', fundamentalAnalysisRoutes);
```

### Frontend: `Portfolio.jsx` or `Dashboard.jsx`

Add import:
```javascript
import FundamentalAnalysis from './components/FundamentalAnalysis';
```

Add component (with your portfolio tickers):
```javascript
const portfolioTickers = ['AAPL', 'GOOGL', 'MSFT']; // Your holdings
<FundamentalAnalysis portfolioTickers={portfolioTickers} />
```

### Environment: `laserbeam/.env`

```bash
VITE_API_URL=https://api.laserbeamcapital.com
```

---

## ✅ Verify Deployment

```bash
# Check backend files exist
ls -la laserbeamnode/routes/fundamental-analysis.routes.js
ls -la laserbeamnode/services/fundamental-analysis.service.js

# Check frontend files exist
ls -la laserbeam/src/components/FundamentalAnalysis.jsx
ls -la laserbeam/src/components/FundamentalAnalysis.css

# Check dependencies installed
cd laserbeamnode && npm list axios
cd laserbeam && npm list axios
```

All should show files/packages exist. ✅

---

## 🧪 Test

1. **Start servers:**
   ```bash
   # Terminal 1
   cd laserbeamnode && npm run dev

   # Terminal 2
   cd laserbeam && npm run dev
   ```

2. **Open dashboard** in browser

3. **Enter "AAPL"** in the fundamental analysis input

4. **Click "Analyze"**

5. **Wait 15-30 seconds**

6. **See BUY/HOLD/SELL recommendation!** 🎉

---

## 🆘 Troubleshooting

**Script says "repo not found"?**
- Your repos might be in a different location
- Use Option 2 (interactive) and enter your paths when prompted

**"Module not found" error?**
- Run `npm install axios` in both repos
- Make sure you registered the routes in server.js

**CORS error?**
- Add CORS middleware in backend:
  ```javascript
  app.use(cors({ origin: 'http://localhost:5173' })); // For dev
  ```

**API error?**
- Check environment variables are set on backend
- Test API directly: `curl http://localhost:3000/api/fundamental-analysis/earnings-calendar/AAPL`

---

## 📚 Documentation

- **`README.md`** - Overview and features
- **`INTEGRATION_GUIDE.md`** - Complete documentation (400+ lines)
- **`MANUAL_COPY.md`** - Step-by-step manual instructions
- **`DEPLOY.md`** - This file (deployment options)

---

## 🎯 What Gets Deployed

### Backend (laserbeamnode)
```
routes/
└── fundamental-analysis.routes.js     # API endpoints

services/
└── fundamental-analysis.service.js    # Core analysis engine

node_modules/
└── axios/                              # HTTP client
```

### Frontend (laserbeam)
```
src/components/
├── FundamentalAnalysis.jsx            # React component
└── FundamentalAnalysis.css            # Styling

.env
└── VITE_API_URL=...                   # Backend URL

node_modules/
└── axios/                              # HTTP client
```

---

## 📊 After Deployment

You'll have:

✅ **3 new API endpoints**
- POST `/api/fundamental-analysis/analyze`
- POST `/api/fundamental-analysis/batch`
- GET `/api/fundamental-analysis/earnings-calendar/:ticker`

✅ **1 new React component**
- `<FundamentalAnalysis />`

✅ **AI-powered analysis** using:
- Financial Datasets AI (your API key)
- Alpha Vantage (your API key)
- Tavily Search (your API key)
- OpenRouter / Claude (your API key)

✅ **Buy/Hold/Sell recommendations** with:
- Confidence scores
- Target prices
- Upside percentages
- Key risks

---

**Pick an option and deploy in minutes!** 🚀

Need help? See `INTEGRATION_GUIDE.md` for troubleshooting.
