<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Goat SNS Plugin

Resolve [SNS](https://www.sns.id/) domain names to Solana addresses.

## Installation
```
npm install @goat-sdk/plugin-sns
yarn add @goat-sdk/plugin-sns
pnpm add @goat-sdk/plugin-sns
```

## Usage

```typescript
import { sns } from "@goat-sdk/plugin-sns";

const tools = await getOnChainTools({
    wallet: // ...
    plugins: [
        sns(),
    ],
});
```

## Tools
- Resolve SNS domain names to Solana addresses

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
