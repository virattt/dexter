# How to add a chain

## 1. Add the chain to the `chain.py` file

Add your chain to the `chain.py` file in the [core package](https://github.com/goat-sdk/goat/tree/main/python/src/goat_sdk/goat/types/chain.py).

```python
class MyAwesomeChain(TypedDict):
    """MyAwesomeChain chain type definition

    Args:
        type: Literal "my-awesome-chain" chain type identifier
    """
    type: Literal["my-awesome-chain"]

# ...
Chain = Union[EvmChain, SolanaChain, MyAwesomeChain]
```

## 2. Create a new wallet provider package

Create a new package in the [wallets directory](https://github.com/goat-sdk/goat/tree/main/python/src/wallets) with the name of your chain (e.g. `my-awesome-chain`) or copy an existing one (e.g. `evm`).
In this package you will define the abstract class for your chain's wallet client which will extend the `WalletClientBase` class defined in the [core package](https://github.com/goat-sdk/goat/tree/main/python/src/goat-sdk/goat/wallets/core.py).

WalletClientBase only includes the methods that are supported by all chains such as:

1. `get_address`
2. `get_chain`
3. `sign_message`
4. `balance_of`

As well as includes the `get_core_tools` method which returns the core tools for the chain.

```python
class MyAwesomeChainWalletClient(WalletClientBase):
    @abstractmethod
    def get_chain(self) -> MyAwesomeChain:
        """Get the EVM chain this wallet is connected to."""
        pass

    @abstractmethod
    def send_transaction(self, transaction: MyAwesomeChainTransaction) -> Dict[str, str]:
        """Send a transaction on the EVM chain."""
        pass

    @abstractmethod
    def read(self, request: MyAwesomeChainReadRequest) -> MyAwesomeChainReadResult:
        """Read data from a smart contract."""
        pass
}
```

## 3. Create a plugin to allow sending your native token to a wallet

Create a plugin to allow sending your native token to a wallet. Create a file in the same package as your wallet client and create a new file like `send<native-token>.py`.

Implement the core plugin.

```python
class SendMYAWESOMETOKENPlugin(PluginBase[MyAwesomeChainWalletClient]):
    def __init__(self):
        super().__init__("sendMYAWESOMETOKEN", [])

    def supports_chain(self, chain: Chain) -> bool:
        return chain["type"] == "my-awesome-chain"

    def get_tools(self, wallet_client: MyAwesomeChainWalletClient) -> List[ToolBase]:
        send_tool = create_tool(
            config={
                "name": f"send_myawesometoken",
                "description": f"Send MYAWESOMETOKEN to an address.",
                "parameters": SendMYAWESOMETOKENParameters,
            },
            execute_fn=lambda params: send_myawesometoken_method(
                wallet_client, cast(Dict[str, str], params)
            ),
        )
        return [send_tool]
```

## 4. Implement the wallet client

Extend your abstract class with the methods you need to implement and create your first wallet client! (e.g `MyAwesomeChainKeyPairWalletClient`)

```python
class MyAwesomeChainKeyPairWalletClient(MyAwesomeChainWalletClient):
    # Implement the methods here
    pass

# Export the wallet client with a factory function
my_awesome_chain_wallet_client = () => MyAwesomeChainKeyPairWalletClient()
```

## 5. Submit a PR

Submit a PR to add your wallet provider to the [wallets directory](https://github.com/goat-sdk/goat/tree/main/typescript/packages/wallets).
