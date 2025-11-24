<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Zetrix Wallet for GOAT
## Installation

```
npm install @goat-sdk/wallet-zetrix
yarn add @goat-sdk/wallet-zetrix
pnpm add @goat-sdk/wallet-zetrix
```

## Usage

```typescript
import ZtxChainSDK from "zetrix-sdk-nodejs";

const sdk = new ZtxChainSDK({
  host: process.env.NODE_URL,
  secure: true
});

const zetrixAccount = process.env.ZETRIX_ACCOUNT;
const zetrixAccountPrivateKey = process.env.ZETRIX_ACCOUNT_PRIVATE_KEY;

const tools = await getOnChainTools({
    wallet: zetrix({
        zetrixSDK: sdk,
        zetrixAccount: zetrixAccount,
        zetrixAccountPrivateKey: zetrixAccountPrivateKey
    }),
});
```

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
