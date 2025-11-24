<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Langchain Adapter for GOAT

Integrate the more than +200 onchain tools of GOAT with [Langchain](https://langchain.com).

## Installation
```
npm install @goat-sdk/adapter-langchain
yarn add @goat-sdk/adapter-langchain
pnpm add @goat-sdk/adapter-langchain
```

## Usage

See a full working example [here](https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-framework/langchain).

```ts
import { getOnChainTools } from "@goat-sdk/adapter-langchain";

const tools = await getOnChainTools({
    wallet: // your wallet
    plugins: // your plugins
});

const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
});

const prompt = await pull<ChatPromptTemplate>("hwchase17/structured-chat-agent");

const agent = await createStructuredChatAgent({
    llm,
    tools,
    prompt,
});

const agentExecutor = new AgentExecutor({
    agent,
    tools,
});

const response = await agentExecutor.invoke({
    input: "Your prompt here",
});
```

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
<div>
</footer>
