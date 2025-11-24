<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Allora GOAT Plugin

[Allora Network](https://allora.network) plugin for Goat. Allora Network is an AI-powered inference platform that delivers real-time, self-improving predictions and insights for various use cases. By aggregating and analyzing data from diverse sources—such as blockchain networks and off-chain APIs—Allora seamlessly provides low-latency, high-performance predictive analytics without requiring complex infrastructure. The platform's intuitive approach allows developers to focus on building intelligence-driven solutions, while Allora takes care of the heavy lifting behind the scenes.

## Installation

```
npm install @goat-sdk/plugin-allora
yarn add @goat-sdk/plugin-allora
pnpm add @goat-sdk/plugin-allora
```

## Setup
    
```typescript
import { allora } from '@goat-sdk/plugin-allora'

const plugin = allora({ 
    apiKey: process.env.ALLORA_API_KEY, // Contact the Allora team on Discord for access to API keys
})
```

## Available Actions
1. Fetch price prediction for the given asset and timeframe.

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
