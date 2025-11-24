<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# ERC721 GOAT Plugin

ERC721 plugin for Goat. Allows you to create tools for transferring and getting the balance of ERC721 tokens.

## Installation
```
npm install @goat-sdk/plugin-erc721
```

## Usage

```typescript
import { erc721, BAYC } from "@goat-sdk/plugin-erc721";

const plugin = erc721({
    tokens: [BAYC],
});
```

### Adding custom tokens
```typescript
import { erc721, BAYC } from "@goat-sdk/plugin-erc721";

const plugin = erc721({
  tokens: [
    BAYC,
    {
      symbol: "PUNK",
      name: "CryptoPunks",
      chains: {
        "1": {
          contractAddress: "0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB",
        },
      },
    },
  ],
});
```

## Tools

1. Get token info by symbol
2. Get balance
3. Transfer
4. Approve
5. Revoke approval
6. Total supply

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
