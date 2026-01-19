# Manual Copy Instructions

If you prefer to copy files manually, here are the exact commands:

## Prerequisites

Make sure you have both repos cloned in the same parent directory:

```
/home/user/
├── dexter/
├── laserbeam/
└── laserbeamnode/
```

## Option 1: Automated Deployment Script

**Run this single command from the dexter repo:**

```bash
cd /home/user/dexter
./integration/deploy.sh
```

The script will:
- ✅ Copy all backend files to laserbeamnode
- ✅ Copy all frontend files to laserbeam
- ✅ Install dependencies (axios)
- ✅ Set up .env file
- ✅ Show you integration instructions

---

## Option 2: Manual Copy Commands

### Backend (laserbeamnode)

```bash
# Copy backend files
cp /home/user/dexter/integration/backend/fundamental-analysis.routes.js \
   /home/user/laserbeamnode/routes/

cp /home/user/dexter/integration/backend/fundamental-analysis.service.js \
   /home/user/laserbeamnode/services/

# Install dependency
cd /home/user/laserbeamnode
npm install axios

# Add to server.js (manually)
# const fundamentalAnalysisRoutes = require('./routes/fundamental-analysis.routes');
# app.use('/api/fundamental-analysis', fundamentalAnalysisRoutes);
```

### Frontend (laserbeam)

```bash
# Copy frontend files
cp /home/user/dexter/integration/frontend/FundamentalAnalysis.jsx \
   /home/user/laserbeam/src/components/

cp /home/user/dexter/integration/frontend/FundamentalAnalysis.css \
   /home/user/laserbeam/src/components/

# Install dependency
cd /home/user/laserbeam
npm install axios

# Add to .env (if not exists)
echo "VITE_API_URL=https://api.laserbeamcapital.com" >> .env

# Add to Portfolio.jsx (manually)
# import FundamentalAnalysis from './components/FundamentalAnalysis';
# <FundamentalAnalysis portfolioTickers={tickers} />
```

---

## Option 3: Copy from Different Location

If your repos are in a different location, adjust the paths:

```bash
# Find your repos
cd ~
find . -name "laserbeam" -type d 2>/dev/null
find . -name "laserbeamnode" -type d 2>/dev/null

# Then copy with your actual paths
DEXTER_PATH="/path/to/dexter"
LASERBEAM_PATH="/path/to/laserbeam"
LASERBEAMNODE_PATH="/path/to/laserbeamnode"

# Backend
cp $DEXTER_PATH/integration/backend/fundamental-analysis.routes.js \
   $LASERBEAMNODE_PATH/routes/

cp $DEXTER_PATH/integration/backend/fundamental-analysis.service.js \
   $LASERBEAMNODE_PATH/services/

# Frontend
cp $DEXTER_PATH/integration/frontend/FundamentalAnalysis.jsx \
   $LASERBEAM_PATH/src/components/

cp $DEXTER_PATH/integration/frontend/FundamentalAnalysis.css \
   $LASERBEAM_PATH/src/components/
```

---

## Verification

After copying, verify files are in place:

```bash
# Check backend
ls -la /home/user/laserbeamnode/routes/fundamental-analysis.routes.js
ls -la /home/user/laserbeamnode/services/fundamental-analysis.service.js

# Check frontend
ls -la /home/user/laserbeam/src/components/FundamentalAnalysis.jsx
ls -la /home/user/laserbeam/src/components/FundamentalAnalysis.css
```

---

## Integration Code Snippets

### Backend: Add to server.js

```javascript
// At the top with other imports
const fundamentalAnalysisRoutes = require('./routes/fundamental-analysis.routes');

// With other route registrations (after middleware setup)
app.use('/api/fundamental-analysis', fundamentalAnalysisRoutes);
```

### Frontend: Add to Portfolio.jsx

```javascript
// At the top with other imports
import FundamentalAnalysis from './components/FundamentalAnalysis';

// Inside your Portfolio component
function Portfolio() {
  // Your existing code...
  const portfolioData = ...; // Your portfolio data
  const portfolioTickers = portfolioData?.positions?.map(p => p.ticker) || [];

  return (
    <div className="portfolio-page">
      {/* Your existing portfolio display */}

      {/* Add this at the bottom */}
      <div className="analysis-section" style={{ marginTop: '48px', paddingTop: '48px', borderTop: '1px solid #2a2a2a' }}>
        <FundamentalAnalysis portfolioTickers={portfolioTickers} />
      </div>
    </div>
  );
}
```

---

## Test

```bash
# Start backend
cd /home/user/laserbeamnode
npm run dev

# Start frontend (in another terminal)
cd /home/user/laserbeam
npm run dev

# Open browser and test
# 1. Navigate to portfolio page
# 2. Enter "AAPL" in the analysis input
# 3. Click "Analyze"
# 4. Wait 15-30 seconds
# 5. See the BUY/HOLD/SELL recommendation!
```

---

## Troubleshooting

**"Module not found" error:**
```bash
# Make sure axios is installed in both repos
cd /home/user/laserbeamnode && npm install axios
cd /home/user/laserbeam && npm install axios
```

**"API URL not found" error:**
```bash
# Check .env file exists and has the right URL
cat /home/user/laserbeam/.env
# Should contain: VITE_API_URL=https://api.laserbeamcapital.com
```

**"Route not found" error:**
```bash
# Make sure you registered the routes in server.js
# Look for: app.use('/api/fundamental-analysis', fundamentalAnalysisRoutes);
```

---

## Quick Checklist

### Backend ✅
- [ ] `fundamental-analysis.routes.js` copied to `routes/`
- [ ] `fundamental-analysis.service.js` copied to `services/`
- [ ] `axios` installed via npm
- [ ] Routes registered in `server.js`
- [ ] Server restarted

### Frontend ✅
- [ ] `FundamentalAnalysis.jsx` copied to `src/components/`
- [ ] `FundamentalAnalysis.css` copied to `src/components/`
- [ ] `axios` installed via npm
- [ ] `VITE_API_URL` set in `.env`
- [ ] Component imported in Portfolio page
- [ ] Component rendered with portfolio tickers
- [ ] Dev server restarted

### Test ✅
- [ ] Can access the analysis section
- [ ] Can enter ticker and click analyze
- [ ] Analysis loads after 15-30 seconds
- [ ] Recommendation card displays
- [ ] Can analyze portfolio holdings by clicking ticker chips

---

**All set! 🚀**

For detailed documentation, see `INTEGRATION_GUIDE.md`
