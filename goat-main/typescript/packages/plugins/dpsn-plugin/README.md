<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Dpsn  Plugin for Goat SDK

This plugin enables goat-agents to  connect  , subscribe to, and interact with data streams available on the [DPSN Data Streams Store](https://streams.dpsn.org/).

Agents can leverage this plugin to consume real-time data for decision-making, reacting to events, or integrating external information feeds.

To provide personalized data streams for your agents, you can create and publish data into your own DPSN topics using the [dpsn-client for node](https://github.com/DPSN-org/dpsn-client-nodejs).

For more information, visit:
-   [DPSN Official Website](https://dpsn.org)

## ✨ Features

- **Seamless Integration**: Connect your GOAT agents to DPSN's decentralized pub/sub network
- **Real-time Data Processing**: Subscribe to and process real-time data streams in your agents
- **Topic Management**: Subscribe and unsubscribe to DPSN topics programmatically or through llm queries
- **Event-based Architecture**: Use event emitters to handle incoming messages efficiently

## Installation
```bash
npm install @goat-sdk/dpsn-plugin
yarn add @goat-sdk/dpsn-plugin
pnpm add @goat-sdk/dpsn-plugin
```

## Usage
```typescript
import { dpsnplugin } from '@goat-sdk/dpsn-plugin';
const dpsn_plugin=dpsnplugin({
        DPSN_URL: process.env.DPSN_URL,
        EVM_WALLET_PVT_KEY: process.env.EVM_WALLET_PVT_KEY
    });
    //Event listener setup to listen to messages on subscribing to dpsn topics.
     const DpsnDataStreamHandler=dpsn_plugin.DpsnDataStream;
     DpsnDataStreamHandler.on("message", (message: unknown) => {
        console.log("Received message from DPSN:", message);
        // Add your message processing logic here
    });
const tools = await getOnChainTools({
    wallet: // ...
    plugins: [
      dpsn_plugin
    ]
});
```

## Tools
* Subscribe to a dpsn topic
* Unsubscribe to a dpsn topic


<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
