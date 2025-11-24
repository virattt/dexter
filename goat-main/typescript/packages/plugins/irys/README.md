<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Irys GOAT Plugin

The Irys Plugin for GOAT SDK enables the funding of accounts, uploading of data, files and folders to the Irys network and the downloading of data from the network.

## Installation

```bash
npm install @goat-sdk/plugin-irys
yarn add @goat-sdk/plugin-irys
pnpm add @goat-sdk/plugin-irys
```

## Usage

```typescript
import { irys } from '@goat-sdk/plugin-irys';

const tools = await getOnChainTools({
    wallet: // ...
    plugins: [
      // rpcURL is only required if network is devnet
      irys({ privateKey: "your EVM wallet private key", paymentToken: "baseeth", network: "devnet", rpcURL: "https://base-sepolia.drpc.org" })
    ]
});
```

See full list of possible values for `paymentToken` in parameter `IrysPaymentToken`

## Tools

- `fund_irys_account`
- `upload_data`
- `upload_file`
- `upload_folder`
- `download_data`

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/4821833e-52e5-4126-a2a1-59e9fa9bebd7" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
