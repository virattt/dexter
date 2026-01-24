# User Manual Design for Dexter

**Date**: 2026-01-18
**Status**: Approved
**Author**: Claude + User Collaboration

## Overview

Create a comprehensive user manual for Dexter that serves both end users (financial analysts, investors, researchers) and developers who want to extend or contribute to the project. The manual will be a single `USER_GUIDE.md` file covering installation, usage, configuration, and development.

## Target Audience

- **End Users**: Financial analysts, investors, researchers who need deep financial analysis
- **Developers**: Contributors who want to extend Dexter's capabilities or fix bugs

## Document Structure

The user manual will consist of 8 main sections:

### 1. Introduction & Overview
- What is Dexter (autonomous financial research AI agent)
- Key capabilities (task planning, autonomous execution, self-validation, real-time data)
- What makes it different from generic AI assistants
- Tech stack summary (Bun, React + Ink, LangChain.js, TypeScript)

### 2. Installation & Setup
- Prerequisites (Bun v1.0+, API keys)
- Installing Bun (platform-specific commands)
- Cloning repository and installing dependencies
- Environment configuration (.env file setup)
- Verification steps

### 3. Quick Start Guide
- First run expectations
- First query example
- Interface tour (chat input, working indicators, answer display)
- Basic navigation (arrows, Ctrl+C, Escape)
- Model switching basics

### 4. User Guide - Commands & Features
- Slash commands (`/model` for provider switching)
- Keyboard shortcuts (Ctrl+C, Escape, arrow keys, exit/quit)
- Query types with examples:
  - Financial statement analysis
  - Multi-company comparisons
  - Crypto analysis
  - News-driven research
- Understanding agent output
- Best practices

### 5. Configuration
- Environment variables list:
  - LLM provider keys (OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY)
  - OLLAMA_BASE_URL
  - FINANCIAL_DATASETS_API_KEY
  - TAVILY_API_KEY (optional)
- Model selection flow
- Provider comparison (when to use each)
- Advanced configuration options
- API key management

### 6. Developer Guide
- Architecture overview (multi-agent system)
- Project structure:
  - `src/agent/` - Core agent logic
  - `src/tools/` - Financial data tools
  - `src/components/` - React/Ink UI
  - `src/hooks/` - State management
  - `src/model/` - LLM integrations
- Adding new tools (registry pattern, Zod schemas)
- Development workflow (dev, typecheck, test commands)
- Contributing guidelines

### 7. Troubleshooting
- API key issues
- Installation problems
- Runtime issues (agent stuck, no response)
- Model-specific issues (Ollama connection, rate limiting)
- Getting help (GitHub Issues)

### 8. FAQ
- General questions (pricing, data sources, offline use)
- Usage questions (accuracy, trading support, company coverage)
- Technical questions (Bun vs Node, extensibility, data storage)

## File Location

`/home/ake/dexter/USER_GUIDE.md`

## Related Tasks

- Update README.md to reference the new USER_GUIDE.md
- Consider adding diagrams for architecture in future iterations
