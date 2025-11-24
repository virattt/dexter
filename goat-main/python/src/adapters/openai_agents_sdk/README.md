<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# OpenAI Agents SDK Adapter for GOAT

Integrate the more than +200 onchain tools of GOAT with [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/).

## Installation
```
pip install goat-sdk-adapter-openai-agents-sdk
poetry add goat-sdk-adapter-openai-agents-sdk
```

## Usage

See a full working example [here](https://github.com/goat-sdk/goat/tree/main/python/examples/by-framework/openai-agents-sdk).

```python
from goat_adapters.openai_agents_sdk.adapter import get_on_chain_tools

tools = get_on_chain_tools(
    wallet=# Your wallet,
    plugins=[
        # Your plugins
    ],
)

agent = Agent(
    name="GOAT Agent",
    instructions=(
        "You are a helpful agent that can interact onchain using the GOAT SDK. "
    ),
    tools=tools
)
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
