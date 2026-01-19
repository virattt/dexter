#!/bin/bash

# Laserbeam Capital - Fundamental Analysis Integration Deployment Script
# Run this from the dexter repository root

set -e  # Exit on error

echo "🚀 Laserbeam Capital - Fundamental Analysis Deployment"
echo "======================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -d "integration" ]; then
    echo -e "${RED}Error: Please run this script from the dexter repository root${NC}"
    exit 1
fi

# Get paths to laserbeam repos
LASERBEAM_PATH="../laserbeam"
LASERBEAMNODE_PATH="../laserbeamnode"

# Check if laserbeam repos exist
if [ ! -d "$LASERBEAM_PATH" ]; then
    echo -e "${YELLOW}Warning: laserbeam repository not found at $LASERBEAM_PATH${NC}"
    read -p "Enter path to laserbeam repository (or press Enter to skip frontend): " CUSTOM_PATH
    if [ -n "$CUSTOM_PATH" ]; then
        LASERBEAM_PATH="$CUSTOM_PATH"
    else
        echo -e "${YELLOW}Skipping frontend deployment${NC}"
        LASERBEAM_PATH=""
    fi
fi

if [ ! -d "$LASERBEAMNODE_PATH" ]; then
    echo -e "${YELLOW}Warning: laserbeamnode repository not found at $LASERBEAMNODE_PATH${NC}"
    read -p "Enter path to laserbeamnode repository (or press Enter to skip backend): " CUSTOM_PATH
    if [ -n "$CUSTOM_PATH" ]; then
        LASERBEAMNODE_PATH="$CUSTOM_PATH"
    else
        echo -e "${YELLOW}Skipping backend deployment${NC}"
        LASERBEAMNODE_PATH=""
    fi
fi

echo ""
echo "📋 Deployment Plan:"
echo "-------------------"
if [ -n "$LASERBEAMNODE_PATH" ]; then
    echo "Backend:  $LASERBEAMNODE_PATH"
fi
if [ -n "$LASERBEAM_PATH" ]; then
    echo "Frontend: $LASERBEAM_PATH"
fi
echo ""

read -p "Continue with deployment? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

echo ""
echo "🔧 Starting deployment..."
echo ""

# Deploy Backend
if [ -n "$LASERBEAMNODE_PATH" ]; then
    echo "📦 Deploying Backend..."

    # Create directories if they don't exist
    mkdir -p "$LASERBEAMNODE_PATH/routes"
    mkdir -p "$LASERBEAMNODE_PATH/services"

    # Copy backend files
    echo "  → Copying fundamental-analysis.routes.js..."
    cp integration/backend/fundamental-analysis.routes.js "$LASERBEAMNODE_PATH/routes/"

    echo "  → Copying fundamental-analysis.service.js..."
    cp integration/backend/fundamental-analysis.service.js "$LASERBEAMNODE_PATH/services/"

    # Install dependencies
    echo "  → Installing axios dependency..."
    cd "$LASERBEAMNODE_PATH"
    npm install axios --save
    cd - > /dev/null

    echo -e "${GREEN}✓ Backend deployed successfully${NC}"
    echo ""

    # Show integration instructions
    echo -e "${YELLOW}📝 Backend Integration Required:${NC}"
    echo "Add this to your server.js or app.js:"
    echo ""
    echo "const fundamentalAnalysisRoutes = require('./routes/fundamental-analysis.routes');"
    echo "app.use('/api/fundamental-analysis', fundamentalAnalysisRoutes);"
    echo ""
fi

# Deploy Frontend
if [ -n "$LASERBEAM_PATH" ]; then
    echo "📦 Deploying Frontend..."

    # Create components directory if it doesn't exist
    mkdir -p "$LASERBEAM_PATH/src/components"

    # Copy frontend files
    echo "  → Copying FundamentalAnalysis.jsx..."
    cp integration/frontend/FundamentalAnalysis.jsx "$LASERBEAM_PATH/src/components/"

    echo "  → Copying FundamentalAnalysis.css..."
    cp integration/frontend/FundamentalAnalysis.css "$LASERBEAM_PATH/src/components/"

    # Install dependencies
    echo "  → Installing axios dependency..."
    cd "$LASERBEAM_PATH"
    npm install axios --save
    cd - > /dev/null

    # Check if .env exists and add VITE_API_URL if missing
    if [ -f "$LASERBEAM_PATH/.env" ]; then
        if ! grep -q "VITE_API_URL" "$LASERBEAM_PATH/.env"; then
            echo ""
            read -p "Enter your API URL (e.g., https://api.laserbeamcapital.com): " API_URL
            echo "VITE_API_URL=$API_URL" >> "$LASERBEAM_PATH/.env"
            echo "  → Added VITE_API_URL to .env"
        fi
    else
        echo ""
        read -p "Enter your API URL (e.g., https://api.laserbeamcapital.com): " API_URL
        echo "VITE_API_URL=$API_URL" > "$LASERBEAM_PATH/.env"
        echo "  → Created .env with VITE_API_URL"
    fi

    echo -e "${GREEN}✓ Frontend deployed successfully${NC}"
    echo ""

    # Show integration instructions
    echo -e "${YELLOW}📝 Frontend Integration Required:${NC}"
    echo "Add this to your Portfolio or Dashboard page:"
    echo ""
    echo "import FundamentalAnalysis from './components/FundamentalAnalysis';"
    echo ""
    echo "function Portfolio() {"
    echo "  const portfolioTickers = ['AAPL', 'GOOGL', 'MSFT']; // Your holdings"
    echo "  return ("
    echo "    <div>"
    echo "      {/* Your existing portfolio code */}"
    echo "      <FundamentalAnalysis portfolioTickers={portfolioTickers} />"
    echo "    </div>"
    echo "  );"
    echo "}"
    echo ""
fi

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "📚 Next Steps:"
echo "1. Add the backend route registration to server.js (see above)"
echo "2. Add the frontend component to your Portfolio page (see above)"
echo "3. Restart your backend server"
echo "4. Restart your frontend dev server"
echo "5. Test with ticker 'AAPL'"
echo ""
echo "📖 For detailed instructions, see:"
echo "   integration/INTEGRATION_GUIDE.md"
echo ""
echo -e "${GREEN}Happy analyzing! 📊${NC}"
