from abc import abstractmethod
from typing import Dict, List

from .evm_wallet_client import EVMWalletClient
from .types import EVMTransaction


class EVMSmartWalletClient(EVMWalletClient):
    @abstractmethod
    def send_batch_of_transactions(self, transactions: List[EVMTransaction]) -> Dict[str, str]:
        """Send a batch of transactions on the EVM chain."""
        pass