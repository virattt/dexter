<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# RugCheck GOAT Plugin

Check if a token is a rug pull on [RugCheck](https://rugcheck.xyz/).

## Installation
``` 
npm install @goat-sdk/plugin-rugcheck
yarn add @goat-sdk/plugin-rugcheck
pnpm add @goat-sdk/plugin-rugcheck
```

## Setup
```typescript
import { rugcheck } from "@goat-sdk/plugin-rugcheck";

const tools = await getOnChainTools({
    wallet: // ...
    plugins: [
        rugcheck(),
    ],
});
```

## Tools
- Get recently detected tokens
- Get trending tokens in the last 24h
- Get tokens with the most votes in the last 24h
- Get recently verified tokens
- Generate a report summary for the given token mint

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
