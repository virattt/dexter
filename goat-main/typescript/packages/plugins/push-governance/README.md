<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# PushGovernance GOAT Plugin

The **PushGovernance** plugin enhances the experience for new adopters of PushChain by simplifying governance interactions. It allows users to interact with the PUSH token and manage voting power efficiently. The plugin includes the following functionalities:

- **delegateVotingPower**: Enables users to delegate their voting power to a specified address.
- **getPushTokenAddress**: Retrieves the address of the PUSH token on various chains.
- **getPushBalance**: Fetches the $PUSH token balance of an address.
- **getVotingPower**: Retrieves the current voting power of an address.
- **getDelegatedTo**: Shows the address to which the user's voting power is delegated.

These features streamline governance participation and enhance the overall user experience in the PushChain ecosystem.

## Installation
```bash
npm install @goat-sdk/plugin-push-governance
yarn add @goat-sdk/plugin-push-governance
pnpm add @goat-sdk/plugin-push-governance
```

## Usage
```typescript
import { pushgovernance } from '@goat-sdk/plugin-push-governance';

const tools = await getOnChainTools({
    wallet: // ...
    plugins: [
       pushgovernance()
    ]
});
```

## Tools
* delegateVotingPower
* getPushTokenAddress
* getPushBalance
* getVotingPower
* getDelegatedTo

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
