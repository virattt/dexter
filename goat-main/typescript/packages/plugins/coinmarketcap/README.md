<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# CoinMarketCap GOAT Plugin

Get quotes and swap on [CoinMarketCap](https://coinmarketcap.com/)

## Installation
```bash
npm install @goat-sdk/plugin-coinmarketcap
yarn add @goat-sdk/plugin-coinmarketcap
pnpm add @goat-sdk/plugin-coinmarketcap
```

## Usage
```typescript
import { coinmarketcap } from '@goat-sdk/plugin-coinmarketcap';

const tools = await getOnChainTools({
    wallet: // ...
    plugins: [
       coinmarketcap({
            apiKey: process.env.COINMARKETCAP_API_KEY // Get it from: https://coinmarketcap.com/api/documentation/v1/
       })
    ]
});
``` 

## Tools
* Get listings
* Get quotes
* Get exchanges market data
* Get latest news
* Get all cryptocurrencies
* Get latest OHLCV values
* Get trending cryptocurrencies
* Get most visited cryptocurrencies
* Get gainers and losers

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
