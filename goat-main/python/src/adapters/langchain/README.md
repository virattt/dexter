<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Langchain Adapter for GOAT

Integrate the more than +200 onchain tools of GOAT with [Langchain](https://langchain.com).

## Installation
```
pip install goat-sdk-adapter-langchain
poetry add goat-sdk-adapter-langchain
```

## Usage

See a full working example [here](https://github.com/goat-sdk/goat/tree/main/python/examples/by-framework/langchain).

```python
from goat_adapters.langchain.adapter import get_on_chain_tools

llm = ChatOpenAI(model="gpt-4o-mini")

tools = get_on_chain_tools(
    wallet=# Your wallet,
    plugins=[
        # Your plugins
    ],
)

agent = create_tool_calling_agent(llm, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools, handle_parsing_errors=True, verbose=True)

agent_executor.invoke({
    "input": "Your prompt here"
})
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
