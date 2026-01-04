# OpenRouter Integration - Implementation Summary

## Overview
This document describes the fully functional OpenRouter support added to Dexter, the AI financial research agent.

## What is OpenRouter?
OpenRouter is a unified API that provides access to multiple LLM providers (Anthropic, OpenAI, Google, Meta, Mistral, etc.) through a single endpoint. This integration allows Dexter users to access any model available on OpenRouter.

## Changes Made

### 1. Environment Configuration (`env.example`)
- Added `OPENROUTER_API_KEY` environment variable

### 2. Environment Utilities (`src/utils/env.ts`)
Added OpenRouter to three configuration maps:
- `PROVIDER_API_KEY_MAP`: Maps 'openrouter' provider ID to 'OPENROUTER_API_KEY'
- `MODEL_API_KEY_MAP`: Maps 'anthropic/claude-3.5-sonnet' model ID to 'OPENROUTER_API_KEY'
- `PROVIDER_DISPLAY_NAMES`: Maps 'openrouter' to 'OpenRouter' display name

### 3. Model Provider Configuration (`src/model/llm.ts`)
Added support for multiple OpenRouter model prefixes:
- `anthropic/` - For Anthropic models via OpenRouter
- `openai/` - For OpenAI models via OpenRouter
- `google/` - For Google models via OpenRouter
- `meta-llama/` - For Meta Llama models via OpenRouter
- `mistralai/` - For Mistral models via OpenRouter

All OpenRouter models use:
- `ChatOpenAI` class from `@langchain/openai`
- Custom base URL: `https://openrouter.ai/api/v1`
- `OPENROUTER_API_KEY` from environment

### 4. Model Selector UI (`src/components/ModelSelector.tsx`)
Added OpenRouter as a selectable provider:
- Display Name: "OpenRouter"
- Provider ID: "openrouter"
- Default Model: "anthropic/claude-3.5-sonnet"
- Description: "Claude 3.5 Sonnet via OpenRouter"

### 5. Documentation (`README.md`)
- Added OpenRouter to prerequisites with link to get API key
- Added OpenRouter API key to environment setup instructions
- Added OpenRouter to the list of available model providers

## How to Use

### Setup
1. Get an OpenRouter API key from https://openrouter.ai/keys
2. Add it to your `.env` file:
   ```
   OPENROUTER_API_KEY=your-openrouter-api-key
   ```

### Switching to OpenRouter
In the Dexter CLI:
1. Type `/model` to open the model selector
2. Select "OpenRouter" from the list
3. Press Enter to confirm

### Using Different OpenRouter Models
While the default OpenRouter model is `anthropic/claude-3.5-sonnet`, you can use any OpenRouter model by directly specifying its full model ID (e.g., `openai/gpt-4-turbo`, `google/gemini-pro`, `meta-llama/llama-3-70b`, etc.). The implementation automatically routes models with the following prefixes through OpenRouter:
- `anthropic/`
- `openai/`
- `google/`
- `meta-llama/`
- `mistralai/`

## Technical Details

### Model Routing Logic
The `getChatModel` function in `src/model/llm.ts` uses prefix matching to determine which provider to use:
1. Checks if the model name starts with any registered prefix in `MODEL_PROVIDERS`
2. If match found, uses the corresponding factory
3. Otherwise, falls back to `DEFAULT_MODEL_FACTORY` (OpenAI)

### OpenRouter Configuration
OpenRouter models are configured using the ChatOpenAI class with a custom base URL. This approach works because OpenRouter's API is OpenAI-compatible.

```typescript
new ChatOpenAI({
  model: name,
  ...opts,
  configuration: {
    baseURL: 'https://openrouter.ai/api/v1',
  },
  apiKey: getApiKey('OPENROUTER_API_KEY', 'OpenRouter'),
})
```

## Benefits
1. **Access to Multiple Providers**: Single API key gives access to models from Anthropic, OpenAI, Google, Meta, and more
2. **Cost Flexibility**: OpenRouter often offers competitive pricing and pay-per-use models
3. **Model Variety**: Access to latest models without needing separate API keys for each provider
4. **Unified Interface**: All models work through the same OpenRouter API

## Testing
- ✅ TypeScript compilation successful
- ✅ All files follow existing code conventions
- ✅ Integration follows the same pattern as other providers (Anthropic, Google)

## Future Enhancements
Potential improvements for future updates:
1. Add more OpenRouter models to the model selector
2. Support for OpenRouter-specific features (e.g., model fallbacks)
3. Cost tracking for OpenRouter usage
4. Support for OpenRouter's site URL and app name headers for better analytics
