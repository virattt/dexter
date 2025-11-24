<div align="center">
    <img src="https://raw.githubusercontent.com/michaelhly/solana-py/master/docs/img/solana-py-logo.jpeg" width="25%" height="25%">
</div>

---

[![Actions
Status](https://github.com/michaelhly/solanapy/workflows/CI/badge.svg)](https://github.com/michaelhly/solanapy/actions?query=workflow%3ACI)
[![PyPI version](https://badge.fury.io/py/solana.svg)](https://badge.fury.io/py/solana)
[![Python versions](https://img.shields.io/pypi/pyversions/solana.svg)]( https://pypi.python.org/pypi/solana)
[![Codecov](https://codecov.io/gh/michaelhly/solana-py/branch/master/graph/badge.svg)](https://codecov.io/gh/michaelhly/solana-py/branch/master)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/michaelhly/solana-py/blob/master/LICENSE)
[![PyPI Downloads](https://static.pepy.tech/badge/solana/month)](https://clickpy.clickhouse.com/dashboard/solana)

# Solana.py

**🐍 The Solana Python SDK 🐍**

Solana.py is the base Python library for interacting with Solana.
You can use it to build transactions and interact
with the
[Solana JSON RPC API](https://docs.solana.com/apps/jsonrpc-api),
much like you would do with
[solana-web3.js](https://github.com/solana-labs/solana-web3.js/)

It also covers the
[SPL Token Program](https://spl.solana.com/token).

[Latest Documentation](https://michaelhly.github.io/solana-py/).

Note: This library uses many core types from the [Solders](https://github.com/kevinheavey/solders) package which used to be provided by `solana-py` itself. If you are upgrading from an old version and you're looking for something that was deleted, it's probably in `solders` now.

**⚓︎ See also: [AnchorPy](https://github.com/kevinheavey/anchorpy),**
**a Python client for**
**[Anchor](https://project-serum.github.io/anchor/getting-started/introduction.html)-based**
**programs on Solana. ⚓︎**

## ⚡ Quickstart

### Installation
1. Install [Python bindings](https://kevinheavey.github.io/solders/) for the [solana-sdk](https://docs.rs/solana-sdk/latest/solana_sdk/).
```sh
pip install solders
```

2. Install this package to interact with the [Solana JSON RPC API](https://solana.com/docs/rpc).
```sh
pip install solana
```

### General Usage

- [Python Cookbook](https://michaelhly.com/solana-py/cookbook/)
- [Solana Cookbook](https://solanacookbook.com/)

### API Client

```py
from solana.rpc.api import Client

http_client = Client("https://api.devnet.solana.com")
```

### Async API Client

```py
import asyncio
from solana.rpc.async_api import AsyncClient

async def main():
    async with AsyncClient("https://api.devnet.solana.com") as client:
        res = await client.is_connected()
    print(res)  # True

    # Alternatively, close the client explicitly instead of using a context manager:
    client = AsyncClient("https://api.devnet.solana.com")
    res = await client.is_connected()
    print(res)  # True
    await client.close()

asyncio.run(main())
```

### Websockets Client

```py
import asyncio
from asyncstdlib import enumerate
from solana.rpc.websocket_api import connect

async def main():
    async with connect("wss://api.devnet.solana.com") as websocket:
        await websocket.logs_subscribe()
        first_resp = await websocket.recv()
        subscription_id = first_resp[0].result
        next_resp = await websocket.recv()
        print(next_resp)
        await websocket.logs_unsubscribe(subscription_id)

    # Alternatively, use the client as an infinite asynchronous iterator:
    async with connect("wss://api.devnet.solana.com") as websocket:
        await websocket.logs_subscribe()
        first_resp = await websocket.recv()
        subscription_id = first_resp[0].result
        async for idx, msg in enumerate(websocket):
            if idx == 3:
                break
            print(msg)
        await websocket.logs_unsubscribe(subscription_id)

asyncio.run(main())
```

## 🔨 Development

### Setup

1. Install [poetry](https://python-poetry.org/docs/#installation)
2. Install dev dependencies:

```sh
poetry install

```

3. Activate the poetry shell.

```sh
poetry shell
```

### Lint

```sh
make lint
```

### Tests

```sh
# All tests
make tests
# Unit tests only
make unit-tests
# Integration tests only
make int-tests
```
