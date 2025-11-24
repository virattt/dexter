from decimal import Decimal
from typing import Dict, List, cast

from pydantic import BaseModel, Field

from goat.classes.plugin_base import PluginBase
from goat.classes.tool_base import ToolBase, create_tool
from goat.types.chain import Chain

from .wallet import MultiversXWalletClient


class SendEGLDParameters(BaseModel):
    receiver: str = Field(description="The address to send EGLD to")
    native_amount: str = Field(description="The amount of EGLD to send")


class SendEGLDPlugin(PluginBase[MultiversXWalletClient]):

    def __init__(self):
        super().__init__("sendEGLD", [])

    def supports_chain(self, chain: Chain) -> bool:
        return chain["type"] == "multiversx"

    def get_tools(self,
                  wallet_client: MultiversXWalletClient) -> List[ToolBase]:
        send_tool = create_tool(
            config={
                "name": "send_EGLD",
                "description": "Send EGLD to an address.",
                "parameters": SendEGLDParameters,
            },
            execute_fn=lambda params: send_egld_method(
                wallet_client, cast(Dict[str, str], params)),
        )

        return [send_tool]


def send_egld() -> SendEGLDPlugin:
    return SendEGLDPlugin()


def send_egld_method(wallet_client: MultiversXWalletClient,
                     parameters: Dict[str, str]) -> str:
    try:
        native_amount = int(
            Decimal(parameters["native_amount"]) * Decimal("1e18"))
        tx = wallet_client.send_transaction({
            "receiver": parameters["receiver"],
            "native_amount": native_amount,
        })
        return tx
    except Exception as error:
        raise Exception(f"Failed to send EGLD: {str(error)}")
