<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Opensea GOAT Plugin
Allows you to create tools for getting NFT collection data from [Opensea](https://opensea.io/).

## Installation
```
npm install @goat-sdk/plugin-opensea
yarn add @goat-sdk/plugin-opensea
pnpm add @goat-sdk/plugin-opensea
```

## Usage

```typescript
import { opensea } from "@goat-sdk/plugin-opensea";

const plugin = opensea({
    apiKey: process.env.OPENSEA_API_KEY as string,
});
```

## Tools
- Get NFT collection statistics
- Get recent NFT sales

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a> 
</div>
</footer>
