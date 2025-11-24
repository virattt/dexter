<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# AG2 Adapter for GOAT

Integrate the more than +200 onchain tools of GOAT with [AG2](https://github.com/ag2ai/ag2), the open-source AgentOS (formerly AutoGen).

## Installation
```
pip install goat-sdk-adapter-ag2
poetry add goat-sdk-adapter-ag2
```

## Usage

See a full working example [here](https://github.com/goat-sdk/goat/tree/main/python/examples/by-framework/ag2).

```python
from goat_adapters.ag2.adapter import register_tools
from autogen import ConversableAgent

crypto_agent = ConversableAgent(
    name="crypto_agent",
    system_message="You are a crypto expert...",
)

executor_agent = ConversableAgent(
    name="executor_agent",
    human_input_mode="NEVER",
)

register_tools(
    caller=crypto_agent,
    executor=executor_agent,
    wallet=# Your wallet,
    plugins=[
        # Your plugins
    ],
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
