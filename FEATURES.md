# Feature Changelog

This document tracks new features and enhancements added to Dexter.

## 2026-02-03: Enhanced OpenRouter Integration

### Overview
Enhanced OpenRouter support to dynamically fetch available models from the OpenRouter API, providing users with an up-to-date, browsable list of models instead of requiring manual text input.

### Changes

#### 1. New OpenRouter API Utility ([src/utils/openrouter.ts](src/utils/openrouter.ts))
- Created `getOpenRouterModels()` function to fetch available models from OpenRouter API
- Endpoint: `https://openrouter.ai/api/v1/models`
- Returns sorted array of model IDs
- Gracefully handles API failures with empty array fallback

#### 2. Model Selection Hook Updates ([src/hooks/useModelSelection.ts](src/hooks/useModelSelection.ts))
- Imported `getOpenRouterModels` utility
- Updated `handleProviderSelect` to fetch OpenRouter models dynamically (similar to Ollama pattern)
- Enhanced `handleModelSelect` to add `openrouter:` prefix to selected models
- OpenRouter now uses list-based selection (`model_select` state) instead of free-text input (`model_input` state)

#### 3. UI Component Enhancements ([src/components/ModelSelector.tsx](src/components/ModelSelector.tsx))
- Updated PROVIDERS array comment to reflect dynamic model fetching
- Added fallback error message when OpenRouter API is unreachable
- Displays: "Unable to fetch models from OpenRouter API. Check your internet connection."

### User Experience Improvements

**Before:**
- Users had to manually type model names (e.g., `anthropic/claude-3.5-sonnet`)
- Required visiting openrouter.ai/models to find model identifiers
- Error-prone due to manual typing

**After:**
- Users can browse and select from a complete list of available OpenRouter models
- Models are fetched in real-time from OpenRouter's API
- Standard list-based selection UI with arrow key navigation
- Automatic `openrouter:` prefix added to selected models
- Graceful fallback with helpful error message if API is unavailable

### Technical Details

**API Integration:**
```typescript
// Fetches all available models from OpenRouter
const models = await getOpenRouterModels();
// Returns: ['openai/gpt-4-turbo', 'anthropic/claude-3.5-sonnet', ...]
```

**Model Storage Format:**
- Selected models are stored with the `openrouter:` prefix
- Example: `openrouter:anthropic/claude-3.5-sonnet`
- This matches the existing pattern used for Ollama (`ollama:model-name`)

**Error Handling:**
- Network failures return empty array
- UI displays helpful message when no models available
- Users can press ESC to return to provider selection

### Backward Compatibility
- Existing OpenRouter configurations continue to work
- Stored model preferences are preserved
- API key management unchanged

### Files Modified
1. [src/utils/openrouter.ts](src/utils/openrouter.ts) - **New file**
2. [src/hooks/useModelSelection.ts](src/hooks/useModelSelection.ts)
3. [src/components/ModelSelector.tsx](src/components/ModelSelector.tsx)

### Future Enhancements
Potential improvements for consideration:
- Cache OpenRouter models list to reduce API calls
- Add model metadata display (context length, pricing)
- Filter/search functionality for large model lists
- Refresh button to reload models without restarting provider selection

---

## Previous Features

### 2026-02-02: Initial OpenRouter Support (commit e4a1aea)
- Added OpenRouter as a provider option
- Free-text input for model names
- Integration with OpenRouter API endpoint
- Environment variable support (OPENROUTER_API_KEY)
