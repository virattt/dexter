#!/bin/bash

# Remote Agent Setup Script
# This script helps you set up the remote agent infrastructure

set -e  # Exit on error

echo "========================================"
echo "Dexter Remote Agent Setup"
echo "========================================"
echo ""

# Check Python version
echo "Checking Python version..."
python_version=$(python3 --version 2>&1 | grep -oP '(?<=Python )\d+\.\d+')
required_version="3.10"

if (( $(echo "$python_version < $required_version" | bc -l) )); then
    echo "❌ Error: Python 3.10 or higher is required (found $python_version)"
    exit 1
fi
echo "✓ Python $python_version found"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "Setting up environment configuration..."
    if [ -f env.example.remote ]; then
        cp env.example.remote .env
        echo "✓ Created .env file from template"
        echo ""
        echo "⚠️  IMPORTANT: Please edit .env and add your API keys before continuing"
        echo ""
        echo "Required API keys:"
        echo "  - E2B_API_KEY (get from https://e2b.dev)"
        echo "  - GITHUB_TOKEN (GitHub Personal Access Token)"
        echo "  - OPENAI_API_KEY (get from https://platform.openai.com)"
        echo "  - FINANCIAL_DATASETS_API_KEY (get from https://financialdatasets.ai)"
        echo ""
        read -p "Press Enter once you've configured your .env file..."
    else
        echo "❌ Error: env.example.remote not found"
        exit 1
    fi
else
    echo "✓ .env file already exists"
fi
echo ""

# Install Dexter dependencies
echo "Installing Dexter dependencies..."
if command -v uv &> /dev/null; then
    echo "Using uv package manager..."
    uv sync
    echo "✓ Dexter dependencies installed"
else
    echo "⚠️  uv not found. Installing with pip instead..."
    pip install -e .
    echo "✓ Dexter dependencies installed (consider installing uv for faster installs)"
fi
echo ""

# Install remote agent dependencies
echo "Installing remote agent dependencies..."
pip install -r remote_agent/requirements.txt
echo "✓ Remote agent dependencies installed"
echo ""

# Validate environment
echo "Validating configuration..."
python3 -c "
from remote_agent.config import RemoteAgentConfig
try:
    config = RemoteAgentConfig.from_env()
    config.validate()
    print('✓ Configuration is valid')
except ValueError as e:
    print(f'❌ Configuration validation failed:')
    print(str(e))
    exit(1)
"
echo ""

# Create examples directory if needed
mkdir -p examples
echo "✓ Examples directory ready"
echo ""

# Setup complete
echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Run a simple example:"
echo "     python examples/simple_remote_agent.py"
echo ""
echo "  2. Try the agent pool:"
echo "     python examples/agent_pool_example.py"
echo ""
echo "  3. Test persistence:"
echo "     python examples/persistent_agent_example.py"
echo ""
echo "Documentation:"
echo "  - Quick Start: REMOTE_AGENT_QUICKSTART.md"
echo "  - Architecture: REMOTE_AGENT_ARCHITECTURE.md"
echo ""
echo "Happy researching! 🚀"
