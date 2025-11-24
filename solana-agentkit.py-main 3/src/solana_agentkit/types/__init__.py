from .publickey import PublicKey
from .account import Account
from typing import List, Optional

from pydantic import BaseModel
from solders.pubkey import Pubkey  # type: ignore


class BaseModelWithArbitraryTypes(BaseModel):
    class Config:
        arbitrary_types_allowed = True

class Creator(BaseModelWithArbitraryTypes):
    address: str
    percentage: int

class CollectionOptions(BaseModelWithArbitraryTypes):
    name: str
    uri: str
    royalty_basis_points: Optional[int] = None
    creators: Optional[List[Creator]] = None

class CollectionDeployment(BaseModelWithArbitraryTypes):
    collection_address: Pubkey
    signature: bytes

class MintCollectionNFTResponse(BaseModelWithArbitraryTypes):
    mint: Pubkey
    metadata: Pubkey

class PumpfunTokenOptions(BaseModelWithArbitraryTypes):
    twitter: Optional[str] = None
    telegram: Optional[str] = None
    website: Optional[str] = None
    initial_liquidity_sol: Optional[float] = None
    slippage_bps: Optional[int] = None
    priority_fee: Optional[int] = None

class PumpfunLaunchResponse(BaseModelWithArbitraryTypes):
    signature: str
    mint: str
    metadata_uri: Optional[str] = None
    error: Optional[str] = None

class LuloAccountSettings(BaseModelWithArbitraryTypes):
    owner: str
    allowed_protocols: Optional[str] = None
    homebase: Optional[str] = None
    minimum_rate: str

class LuloAccountDetailsResponse(BaseModelWithArbitraryTypes):
    total_value: float
    interest_earned: float
    realtime_apy: float
    settings: LuloAccountSettings

class NetworkPerformanceMetrics(BaseModelWithArbitraryTypes):
    """Data structure for Solana network performance metrics."""
    transactions_per_second: float
    total_transactions: int
    sampling_period_seconds: int
    current_slot: int

class TokenDeploymentResult(BaseModelWithArbitraryTypes):
    """Result of a token deployment operation."""
    mint: Pubkey
    transaction_signature: str

class TokenLaunchResult(BaseModelWithArbitraryTypes):
    """Result of a token launch operation."""
    signature: str
    mint: str
    metadata_uri: str

class TransferResult(BaseModelWithArbitraryTypes):
    """Result of a transfer operation."""
    signature: str
    from_address: str
    to_address: str
    amount: float
    token: Optional[str] = None

class JupiterTokenData(BaseModelWithArbitraryTypes):
    address:str
    symbol:str
    name:str
__all__ = ['PublicKey', 'Account']