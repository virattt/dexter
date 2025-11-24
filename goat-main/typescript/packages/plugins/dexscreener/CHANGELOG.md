# @goat-sdk/plugin-dexscreener

## 0.1.9

### Patch Changes

- 8fb5907: Remove dot from tool name

## 0.1.8

### Patch Changes

- 80df4a5: Update package.json

## 0.1.7

### Patch Changes

- Updated dependencies [f73ce74]
  - @goat-sdk/core@0.4.9

## 0.1.6

### Patch Changes

- Updated dependencies [3091a49]
  - @goat-sdk/core@0.4.8

## 0.1.5

### Patch Changes

- Updated dependencies [a21a1f3]
  - @goat-sdk/core@0.4.7

## 0.1.4

### Patch Changes

- 2b4b8e8: worldstore: initial release
- Updated dependencies [2b4b8e8]
  - @goat-sdk/core@0.4.6

## 0.1.3

### Patch Changes

- Updated dependencies [b9af25b]
  - @goat-sdk/core@0.4.5

## 0.1.2

### Patch Changes

- Updated dependencies [50180d4]
  - @goat-sdk/core@0.4.4

## 0.1.1

### Patch Changes

- 02ccdca: feat: add dexscreener plugin with rate-limited API tools for DEX pair data

  - Implements getPairsByChainAndPair for fetching specific pairs
  - Adds searchPairs for query-based pair discovery
  - Provides getTokenPairs for bulk token pair information
  - Includes built-in rate limiting (300 req/min for pairs endpoint)
