<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# BetSwirl GOAT Plugin

The BetSwirl plugin offers a seamless way to interact with the [BetSwirl](https://www.betswirl.com) betting platform through GOAT. It includes tools for placing bets on games and retrieving bets information. The plugin ensures that all interactions are validated and processed securely, providing agents with a reliable betting experience.

## Installation
```bash
npm install @goat-sdk/plugin-betswirl
yarn add @goat-sdk/plugin-betswirl
pnpm add @goat-sdk/plugin-betswirl
```

## Usage
```typescript
import { betswirl } from '@goat-sdk/plugin-betswirl';

const tools = await getOnChainTools({
    wallet: // ...
    plugins: [
       betswirl(process.env.THEGRAPH_API_KEY) // Optional TheGraph API Key (rate limits applies). Get one from https://thegraph.com/studio/apikeys/
    ]
});
```

## Tools
* Flip a Coin
* Roll a Dice
* Spin a Roulette
* Get bets

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
