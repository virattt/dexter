<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Farcaster GOAT Plugin

[Farcaster](https://farcaster.xyz/) plugin for Goat. Allows you to create tools for interacting with the Farcaster social protocol through the Neynar API.

## Installation
```bash
npm install @goat-sdk/plugin-farcaster
yarn add @goat-sdk/plugin-farcaster
pnpm add @goat-sdk/plugin-farcaster
```

## Usage
    
```typescript
import { farcaster } from "@goat-sdk/plugin-farcaster";

const plugin = farcaster({ 
    apiKey: process.env.NEYNAR_API_KEY 
});
```


## Tools

- Full Farcaster protocol support through Neynar API
- Cast creation and interaction
- Thread and conversation management
- Search functionality
- Authentication via Signer UUID
- Proper error handling
- TypeScript support with complete type definitions

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
