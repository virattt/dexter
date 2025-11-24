from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal, Union


class BaseModelWithoutNone(BaseModel):
    """Base model that excludes None values from model_dump output."""

    def model_dump(self) -> Dict[str, Any]:  # type: ignore
        """Convert model to dictionary, filtering out None values."""
        data = super().model_dump()
        return {k: v for k, v in data.items() if v is not None}


class WalletType(str, Enum):
    """Wallet types supported by Crossmint."""
    SOLANA_CUSTODIAL = "solana-custodial-wallet"
    EVM_SMART_WALLET = "evm-smart-wallet"
    SOLANA_SMART_WALLET = "solana-smart-wallet"


class CoreSignerType(str, Enum):
    """Core signer types supported by Crossmint."""
    EVM_KEYPAIR = "evm-keypair"
    SOLANA_KEYPAIR = "solana-keypair"
    WEBAUTHN = "webauthn"
    EVM_FIREBLOCKS_CUSTODIAL = "evm-fireblocks-custodial"
    SOLANA_FIREBLOCKS_CUSTODIAL = "solana-fireblocks-custodial"
    EVM_KEYPAIR_SESSION = "evm-keypair-session"


class AdminSigner(BaseModelWithoutNone):
    """Configuration for admin signer in wallet creation."""
    type: CoreSignerType
    address: Optional[str] = None
    locator: Optional[str] = None
    signature: Optional[str] = None
    chain: Optional[str] = None


class SolanaFireblocksSigner(BaseModelWithoutNone):
    """Configuration for Solana Fireblocks custodial signer."""
    type: Literal[CoreSignerType.SOLANA_FIREBLOCKS_CUSTODIAL]
    address: str


class SolanaKeypairSigner(BaseModelWithoutNone):
    """Configuration for Solana keypair signer."""
    type: Literal[CoreSignerType.SOLANA_KEYPAIR]
    address: str


SolanaSmartWalletSigner = Union[SolanaFireblocksSigner, SolanaKeypairSigner]


class CreateSmartWalletParameters(BaseModelWithoutNone):
    """Parameters for creating a smart wallet."""
    admin_signer: Optional[AdminSigner] = Field(
        None,
        description="Optional admin signer configuration for the wallet"
    )
    chain: Optional[str] = Field(
        None,
        description="Chain identifier (required for smart wallets)"
    )


class CreateCustodialWalletParameters(BaseModelWithoutNone):
    """Parameters for creating a Solana custodial wallet."""
    linked_user: str = Field(
        description="User identifier to link the wallet to (email, phone, or user ID)"
    )


class CreateWalletRequest(BaseModelWithoutNone):
    """Request parameters for wallet creation."""
    type: WalletType = Field(description="Type of wallet to create")
    config: Optional[Dict[str, Any]] = Field(
        None,
        description="Optional configuration including admin signer"
    )
    linked_user: Optional[str] = Field(
        None,
        description="Optional user identifier to link the wallet to"
    )


class WalletResponse(BaseModelWithoutNone):
    """Response structure for wallet operations."""
    type: str
    address: str
    config: Dict[str, Any]
    linked_user: Optional[str] = None
    created_at: str


class Call(BaseModelWithoutNone):
    """Structure for EVM transaction calls."""
    to: str
    value: str
    data: str


class SolanaSmartWalletTransactionParams(BaseModelWithoutNone):
    """Parameters for creating a Solana Smart Wallet transaction."""
    transaction: str = Field(
        description="Base58 encoded serialized Solana transaction")
    required_signers: Optional[List[str]] = Field(
        None,
        description="Optional array of additional signers required for the transaction"
    )
    signer: Optional[str] = Field(
        None,
        description="Optional signer locator"
    )


class EVMTypedData(BaseModel):
    """EVM typed data structure for signing."""
    types: Dict[str, List[Dict[str, str]]]
    primaryType: str
    domain: Dict[str, Any]
    message: Dict[str, Any]


class TransactionParams(BaseModelWithoutNone):
    """Parameters for transaction creation."""
    calls: Optional[List[Call]] = None
    chain: Optional[Literal["ethereum", "polygon", "avalanche",
                            "arbitrum", "optimism", "base", "sepolia"]] = None
    signer: Optional[str] = None
    transaction: Optional[str] = None
    signers: Optional[List[str]] = None


class ApprovalSubmission(BaseModelWithoutNone):
    """Structure for transaction/signature approvals."""
    signer: str
    message: str
    submitted_at: str
    signature: str
    metadata: Optional[Dict[str, Any]] = None


class TransactionApprovals(BaseModelWithoutNone):
    """Structure for transaction approvals."""
    pending: List[Dict[str, Any]]
    submitted: List[ApprovalSubmission]
    required: Optional[int] = None


class SignMessageRequest(BaseModelWithoutNone):
    """Request parameters for message signing."""
    type: str = Field(
        description="Message type (evm-message or solana-message)")
    params: Dict[str, Any] = Field(
        description="Message parameters including the message to sign")


class SignTypedDataRequest(BaseModelWithoutNone):
    """Request parameters for typed data signing."""
    type: Literal["evm-typed-data"]
    params: Dict[str, Any] = Field(
        description="Parameters including typed data and chain")


class SignatureResponse(BaseModelWithoutNone):
    """Response structure for signature operations."""
    id: str
    wallet_type: str
    status: str
    output_signature: Optional[str] = None
    approvals: TransactionApprovals
    created_at: str


class TransactionResponse(BaseModelWithoutNone):
    """Response structure for transaction operations."""
    id: str
    wallet_type: str
    status: str
    approvals: Optional[TransactionApprovals] = None
    params: TransactionParams
    on_chain: Optional[Dict[str, Any]] = None
    created_at: str


class CollectionMetadata(BaseModelWithoutNone):
    name: str = Field(description="The name of the collection")
    description: str = Field(description="A description of the NFT collection")
    image: Optional[str] = Field(
        None, description="URL pointing to an image that represents the collection")
    symbol: Optional[str] = Field(
        None, description="Shorthand identifier for the NFT collection (Max length: 10)")


class CollectionParameters(BaseModelWithoutNone):
    metadata: CollectionMetadata = Field(
        default_factory=lambda: CollectionMetadata(
            name="My first Minting API Collection",
            description="An NFT Collection created with the Crossmint Minting API",
            image="https://www.crossmint.com/assets/crossmint/logo.png",
            symbol=None
        )
    )
    fungibility: Literal["semi-fungible",
                         "non-fungible"] = Field(default="non-fungible")
    transferable: bool = Field(default=True)


class NFTAttribute(BaseModelWithoutNone):
    display_type: Literal["number", "boost_number", "boost_percentage"]
    value: str


class NFTMetadata(BaseModelWithoutNone):
    name: str = Field(description="The name of the NFT")
    description: str = Field(description="The description of the NFT")
    image: str = Field(description="URL pointing to the NFT image")
    animation_url: Optional[str] = Field(
        None, description="URL pointing to the NFT animation")
    attributes: Optional[List[NFTAttribute]] = Field(
        None, description="The attributes of the NFT")


class MintNFTParameters(BaseModelWithoutNone):
    collection_id: str = Field(
        description="The ID of the collection to mint the NFT in")
    recipient: str = Field(description="The recipient of the NFT")
    recipient_type: Literal["wallet", "email"] = Field(
        default="email",
        description="The type of the recipient"
    )
    metadata: NFTMetadata = Field(description="The metadata of the NFT")


class CreateWalletForTwitterUserParameters(BaseModelWithoutNone):
    """Parameters for creating a wallet for a Twitter user."""
    username: str = Field(description="The username of the Twitter / X user")
    chain: Literal["evm", "solana", "aptos", "cardano", "sui"] = Field(
        description="The chain of the wallet"
    )


class CreateWalletForEmailParameters(BaseModelWithoutNone):
    """Parameters for creating a wallet for an email user."""
    email: str = Field(description="The email address of the user")
    chain: Literal["evm", "solana", "aptos", "cardano", "sui"] = Field(
        description="The chain of the wallet"
    )


class GetWalletByTwitterUsernameParameters(BaseModelWithoutNone):
    """Parameters for retrieving a wallet by Twitter username."""
    username: str = Field(description="The username of the Twitter / X user")
    chain: str = Field(description="The chain of the wallet")


class GetWalletByEmailParameters(BaseModelWithoutNone):
    """Parameters for retrieving a wallet by email."""
    email: str = Field(description="The email address of the user")
    chain: str = Field(description="The chain of the wallet")


class RequestFaucetTokensParameters(BaseModelWithoutNone):
    """Parameters for requesting tokens from faucet."""
    wallet_address: str = Field(
        description="The wallet address to receive tokens")
    chain_id: str = Field(description="The chain ID for the faucet request")


class GetWalletParameters(BaseModelWithoutNone):
    """Parameters for retrieving wallet details."""
    locator: str = Field(description="The wallet locator")


class SignMessageCustodialParameters(BaseModelWithoutNone):
    """Parameters for signing a message with a custodial wallet."""
    locator: str = Field(description="The wallet locator")
    message: str = Field(description="The message to sign")


class SignMessageSmartParameters(BaseModelWithoutNone):
    """Parameters for signing a message with a smart wallet."""
    wallet_address: str = Field(description="The wallet address")
    message: str = Field(description="The message to sign")
    chain: str = Field(description="The chain of the wallet")
    signer: Optional[str] = Field(None, description="Optional signer address")


class SignTypedDataSmartParameters(BaseModelWithoutNone):
    """Parameters for signing typed data with a smart wallet."""
    wallet_address: str = Field(description="The wallet address")
    typed_data: Dict[str, Any] = Field(description="The typed data to sign")
    chain: str = Field(description="The chain of the wallet")
    signer: str = Field(description="The signer address")


class CheckSignatureStatusParameters(BaseModelWithoutNone):
    """Parameters for checking signature status."""
    signature_id: str = Field(description="The ID of the signature")
    wallet_address: str = Field(description="The wallet address")


class CreateTransactionCustodialParameters(BaseModelWithoutNone):
    """Parameters for creating a transaction with a custodial wallet."""
    locator: str = Field(description="The wallet locator")
    transaction: str = Field(description="The transaction data")


class CreateTransactionSmartParameters(BaseModelWithoutNone):
    """Parameters for creating a transaction with a smart wallet."""
    wallet_address: str = Field(description="The wallet address")
    calls: Optional[List[Call]] = Field(
        None, description="The transaction calls for EVM")
    chain: str = Field(description="The chain of the wallet")
    transaction: Optional[str] = Field(
        None, description="Base58 encoded serialized Solana transaction")
    signer: Optional[str] = Field(None, description="Optional signer address")


class ApprovalItem(BaseModelWithoutNone):
    """Structure for individual approval items."""
    signer: str = Field(description="The signer address")
    signature: str = Field(description="The signature")


class ApproveTransactionParameters(BaseModelWithoutNone):
    """Parameters for approving a transaction."""
    locator: str = Field(description="The wallet locator")
    transaction_id: str = Field(description="The transaction ID")
    approvals: List[ApprovalItem] = Field(
        description="List of transaction approvals")


class CheckTransactionStatusParameters(BaseModelWithoutNone):
    """Parameters for checking transaction status."""
    locator: str = Field(description="The wallet locator")
    transaction_id: str = Field(description="The transaction ID")


class DelegatedSignerPermission(BaseModelWithoutNone):
    """Permission object for delegated signers following ERC-7715."""
    type: str = Field(description="Permission type")
    value: Any = Field(description="Permission value")


class RegisterDelegatedSignerParameters(BaseModelWithoutNone):
    """Parameters for registering a delegated signer."""
    signer: str = Field(description="The locator of the delegated signer")
    chain: str = Field(description="Chain identifier")
    expires_at: Optional[int] = Field(
        None, description="Optional expiry date in milliseconds since UNIX epoch")
    permissions: Optional[List[DelegatedSignerPermission]] = Field(
        None, description="Optional list of ERC-7715 permission objects")


class GetDelegatedSignerParameters(BaseModelWithoutNone):
    """Parameters for retrieving delegated signer information."""
    wallet_locator: str = Field(description="The wallet locator")
    signer_locator: str = Field(description="The signer locator")


class EmptyParameters(BaseModelWithoutNone):
    """Empty parameter schema for endpoints that take no parameters."""
    pass
