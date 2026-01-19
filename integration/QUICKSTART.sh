#!/bin/bash
# One-command deployment for Laserbeam Capital Fundamental Analysis
# Assumes standard directory structure: /home/user/{dexter,laserbeam,laserbeamnode}

set -e

echo "🚀 Quick Start Deployment"
echo "=========================="

# Backend
echo "📦 Backend..."
cp /home/user/dexter/integration/backend/fundamental-analysis.routes.js /home/user/laserbeamnode/routes/ 2>/dev/null && echo "  ✓ Routes copied" || echo "  ⚠ Routes copy failed (repo not found?)"
cp /home/user/dexter/integration/backend/fundamental-analysis.service.js /home/user/laserbeamnode/services/ 2>/dev/null && echo "  ✓ Service copied" || echo "  ⚠ Service copy failed (repo not found?)"
cd /home/user/laserbeamnode 2>/dev/null && npm install axios --silent && echo "  ✓ Dependencies installed" || echo "  ⚠ Dependency install failed"

# Frontend
echo "📦 Frontend..."
cp /home/user/dexter/integration/frontend/FundamentalAnalysis.jsx /home/user/laserbeam/src/components/ 2>/dev/null && echo "  ✓ Component copied" || echo "  ⚠ Component copy failed (repo not found?)"
cp /home/user/dexter/integration/frontend/FundamentalAnalysis.css /home/user/laserbeam/src/components/ 2>/dev/null && echo "  ✓ Styles copied" || echo "  ⚠ Styles copy failed (repo not found?)"
cd /home/user/laserbeam 2>/dev/null && npm install axios --silent && echo "  ✓ Dependencies installed" || echo "  ⚠ Dependency install failed"

echo ""
echo "✅ Files copied!"
echo ""
echo "📝 Next: Add these to your code"
echo ""
echo "Backend (server.js):"
echo "  const fundamentalAnalysisRoutes = require('./routes/fundamental-analysis.routes');"
echo "  app.use('/api/fundamental-analysis', fundamentalAnalysisRoutes);"
echo ""
echo "Frontend (Portfolio.jsx):"
echo "  import FundamentalAnalysis from './components/FundamentalAnalysis';"
echo "  <FundamentalAnalysis portfolioTickers={tickers} />"
echo ""
echo "📖 Full guide: integration/INTEGRATION_GUIDE.md"
