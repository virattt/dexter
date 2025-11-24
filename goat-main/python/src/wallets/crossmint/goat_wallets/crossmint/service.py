from goat.decorators.tool import Tool
from goat_wallets.evm import EVMWalletClient
from goat_wallets.solana import SolanaWalletClient
from typing import Any, Dict

from .parameters import (
    CreateSmartWalletParameters,
    CreateCustodialWalletParameters,
    WalletResponse,
    SignatureResponse,
    TransactionResponse,
    Call,
    CollectionParameters,
    MintNFTParameters,
    CreateWalletForTwitterUserParameters,
    CreateWalletForEmailParameters,
    GetWalletByTwitterUsernameParameters,
    GetWalletByEmailParameters,
    RequestFaucetTokensParameters,
    GetWalletParameters,
    SignMessageCustodialParameters,
    SignMessageSmartParameters,
    SignTypedDataSmartParameters,
    CheckSignatureStatusParameters,
    CreateTransactionCustodialParameters,
    CreateTransactionSmartParameters,
    ApproveTransactionParameters,
    CheckTransactionStatusParameters,
    EmptyParameters
)
from .api_client import CrossmintWalletsAPI


class CrossmintService:
    """Service class for interacting with Crossmint API."""

    def __init__(self, api_key: str, base_url: str = "https://api.crossmint.com"):
        """Initialize the Crossmint service.
        
        Args:
            api_key: API key for authentication
            base_url: Base URL for the Crossmint API
        """
        self.api_client = CrossmintWalletsAPI(api_key, base_url)

    @Tool({
        "description": "Create a new EVM smart wallet",
        "parameters_schema": CreateSmartWalletParameters
    })
    def create_smart_wallet(self, wallet_client: EVMWalletClient, parameters: dict) -> WalletResponse:
        """Create a new EVM smart wallet.
        
        Args:
            wallet_client: EVM wallet client
            parameters: Smart wallet creation parameters
        
        Returns:
            Created wallet details
        """
        try:
            response = self.api_client.create_smart_wallet(parameters.get("admin_signer")) # type: ignore
            return WalletResponse(**response)
        except Exception as error:
            raise Exception(f"Failed to create smart wallet: {error}")

    @Tool({
        "description": "Create a new Solana custodial wallet",
        "parameters_schema": CreateCustodialWalletParameters
    })
    def create_custodial_wallet(self, wallet_client: SolanaWalletClient, parameters: dict) -> WalletResponse:
        """Create a new Solana custodial wallet.
        
        Args:
            wallet_client: Solana wallet client
            parameters: Custodial wallet creation parameters
        
        Returns:
            Created wallet details
        """
        try:
            response = self.api_client.create_custodial_wallet(parameters["linked_user"])
            return WalletResponse(**response)
        except Exception as error:
            raise Exception(f"Failed to create custodial wallet: {error}")

    @Tool({
        "description": "Get wallet details by locator",
        "parameters_schema": GetWalletParameters
    })
    def get_wallet(self, wallet_client: EVMWalletClient, parameters: dict) -> WalletResponse:
        """Get wallet details by locator.
        
        Args:
            wallet_client: Wallet client
            parameters: Parameters containing wallet locator
        
        Returns:
            Wallet details
        """
        try:
            response = self.api_client.get_wallet(parameters["locator"])
            return WalletResponse(**response)
        except Exception as error:
            raise Exception(f"Failed to get wallet: {error}")

    @Tool({
        "description": "Sign a message using a Solana custodial wallet",
        "parameters_schema": SignMessageCustodialParameters
    })
    def sign_message_custodial(self, wallet_client: SolanaWalletClient, parameters: dict) -> SignatureResponse:
        """Sign a message using a Solana custodial wallet.
        
        Args:
            wallet_client: Solana wallet client
            parameters: Parameters containing locator and message
        
        Returns:
            Signature response
        """
        try:
            response = self.api_client.sign_message_for_custodial_wallet(
                parameters["locator"],
                parameters["message"]
            )
            return SignatureResponse(**response)
        except Exception as error:
            raise Exception(f"Failed to sign message: {error}")

    @Tool({
        "description": "Sign a message using an EVM smart wallet",
        "parameters_schema": SignMessageSmartParameters
    })
    def sign_message_smart(self, wallet_client: EVMWalletClient, parameters: dict) -> SignatureResponse:
        """Sign a message using an EVM smart wallet.
        
        Args:
            wallet_client: EVM wallet client
            parameters: Parameters containing wallet address, message, chain, and optional signer
        
        Returns:
            Signature response
        """
        try:
            response = self.api_client.sign_message_for_smart_wallet(
                parameters["wallet_address"],
                parameters["message"],
                parameters["chain"],
                parameters.get("signer")
            )
            return SignatureResponse(**response)
        except Exception as error:
            raise Exception(f"Failed to sign message: {error}")

    @Tool({
        "description": "Sign typed data using an EVM smart wallet",
        "parameters_schema": SignTypedDataSmartParameters
    })
    def sign_typed_data_smart(self, wallet_client: EVMWalletClient, parameters: dict) -> SignatureResponse:
        """Sign typed data using an EVM smart wallet.
        
        Args:
            wallet_client: EVM wallet client
            parameters: Parameters containing wallet address, typed data, chain, and signer
        
        Returns:
            Signature response
        """
        try:
            response = self.api_client.sign_typed_data_for_smart_wallet(
                parameters["wallet_address"],
                parameters["typed_data"],
                parameters["chain"],
                parameters["signer"]
            )
            return SignatureResponse(**response)
        except Exception as error:
            raise Exception(f"Failed to sign typed data: {error}")

    @Tool({
        "description": "Check signature status",
        "parameters_schema": CheckSignatureStatusParameters
    })
    def check_signature_status(self, wallet_client: EVMWalletClient, parameters: dict) -> SignatureResponse:
        """Check the status of a signature request.
        
        Args:
            wallet_client: Wallet client
            parameters: Parameters containing signature ID and wallet address
        
        Returns:
            Signature status
        """
        try:
            response = self.api_client.check_signature_status(
                parameters["signature_id"],
                parameters["wallet_address"]
            )
            return SignatureResponse(**response)
        except Exception as error:
            raise Exception(f"Failed to check signature status: {error}")

    @Tool({
        "description": "Create a transaction using a Solana custodial wallet",
        "parameters_schema": CreateTransactionCustodialParameters
    })
    def create_transaction_custodial(self, wallet_client: SolanaWalletClient, parameters: dict) -> TransactionResponse:
        """Create a transaction using a Solana custodial wallet.
        
        Args:
            wallet_client: Solana wallet client
            parameters: Parameters containing locator and transaction data
        
        Returns:
            Transaction response
        """
        try:
            response = self.api_client.create_transaction_for_custodial_wallet(
                parameters["locator"],
                parameters["transaction"]
            )
            return TransactionResponse(**response)
        except Exception as error:
            raise Exception(f"Failed to create transaction: {error}")

    @Tool({
        "description": "Create a transaction using an EVM smart wallet",
        "parameters_schema": CreateTransactionSmartParameters
    })
    def create_transaction_smart(self, wallet_client: EVMWalletClient, parameters: dict) -> TransactionResponse:
        """Create a transaction using an EVM smart wallet.
        
        Args:
            wallet_client: EVM wallet client
            parameters: Parameters containing wallet address, calls, chain, and optional signer
        
        Returns:
            Transaction response
        """
        try:
            response = self.api_client.create_transaction_for_smart_wallet(
                parameters["wallet_address"],
                [Call(**call) for call in parameters["calls"]],
                parameters["chain"],
                parameters.get("signer")
            )
            return TransactionResponse(**response)
        except Exception as error:
            raise Exception(f"Failed to create transaction: {error}")

    @Tool({
        "description": "Approve a transaction",
        "parameters_schema": ApproveTransactionParameters
    })
    def approve_transaction(self, wallet_client: EVMWalletClient, parameters: dict) -> TransactionResponse:
        """Approve a transaction.
        
        Args:
            wallet_client: Wallet client
            parameters: Parameters containing locator, transaction ID, and approvals
        
        Returns:
            Transaction response
        """
        try:
            response = self.api_client.approve_transaction(
                parameters["locator"],
                parameters["transaction_id"],
                parameters["approvals"]
            )
            return TransactionResponse(**response)
        except Exception as error:
            raise Exception(f"Failed to approve transaction: {error}")

    @Tool({
        "description": "Check transaction status",
        "parameters_schema": CheckTransactionStatusParameters
    })
    def check_transaction_status(self, wallet_client: EVMWalletClient, parameters: dict) -> TransactionResponse:
        """Check the status of a transaction.
        
        Args:
            wallet_client: Wallet client
            parameters: Parameters containing locator and transaction ID
        
        Returns:
            Transaction status
        """
        try:
            response = self.api_client.check_transaction_status(
                parameters["locator"],
                parameters["transaction_id"]
            )
            return TransactionResponse(**response)
        except Exception as error:
            raise Exception(f"Failed to check transaction status: {error}")

    @Tool({
        "description": "Create a new NFT collection",
        "parameters_schema": CollectionParameters
    })
    def create_collection(self, wallet_client: EVMWalletClient, parameters: CollectionParameters) -> dict:
        """Create a new NFT collection.
        
        Args:
            wallet_client: EVM wallet client
            parameters: Collection creation parameters
        
        Returns:
            Created collection details
        """
        try:
            result = self.api_client.create_collection(parameters.model_dump(), "polygon")
            if result.get("error"):
                raise Exception(result["message"])
            
            action = self.api_client.wait_for_action(result["actionId"])
            
            return {
                "collectionId": result["id"],
                "chain": "polygon",
                "contractAddress": action["data"]["collection"]["contractAddress"]
            }
        except Exception as error:
            raise Exception(f"Failed to create collection: {error}")

    @Tool({
        "description": "Get all collections",
        "parameters_schema": EmptyParameters
    })
    def get_all_collections(self, wallet_client: EVMWalletClient, parameters: dict) -> Dict[str, Any]:
        """Get all collections.
        
        Args:
            wallet_client: EVM wallet client
            parameters: Empty parameters
        
        Returns:
            Response containing list of collections
        """
        try:
            return self.api_client.get_all_collections()
        except Exception as error:
            raise Exception(f"Failed to get collections: {error}")

    @Tool({
        "description": "Mint an NFT in a collection",
        "parameters_schema": MintNFTParameters
    })
    def mint_nft(self, wallet_client: EVMWalletClient, parameters: MintNFTParameters) -> dict:
        """Mint a new NFT.
        
        Args:
            wallet_client: EVM wallet client
            parameters: NFT minting parameters
        
        Returns:
            Minted NFT details
        """
        try:
            recipient = f"email:{parameters.recipient}:polygon" if parameters.recipient_type == "email" else f"polygon:{parameters.recipient}"
            
            result = self.api_client.mint_nft(
                parameters.collection_id,
                recipient,
                parameters.metadata.model_dump()
            )
            
            if result.get("error"):
                raise Exception(result["message"])
            
            action = self.api_client.wait_for_action(result["actionId"])
            
            return {
                "id": result["id"],
                "collectionId": parameters.collection_id,
                "contractAddress": result["onChain"]["contractAddress"],
                "chain": action["data"]["chain"]
            }
        except Exception as error:
            raise Exception(f"Failed to mint NFT: {error}")

    @Tool({
        "description": "Create a wallet for a Twitter user",
        "parameters_schema": CreateWalletForTwitterUserParameters
    })
    def create_wallet_for_twitter_user(self, wallet_client: EVMWalletClient, parameters: CreateWalletForTwitterUserParameters) -> WalletResponse:
        """Create a wallet for a Twitter user.
        
        Args:
            wallet_client: EVM wallet client
            parameters: Twitter user wallet creation parameters
        
        Returns:
            Created wallet details
        """
        try:
            response = self.api_client.create_wallet_for_twitter(
                parameters.username,
                parameters.chain
            )
            return WalletResponse(**response)
        except Exception as error:
            raise Exception(f"Failed to create wallet for Twitter user: {error}")

    @Tool({
        "description": "Create a wallet for an email user",
        "parameters_schema": CreateWalletForEmailParameters
    })
    def create_wallet_for_email(self, wallet_client: EVMWalletClient, parameters: CreateWalletForEmailParameters) -> WalletResponse:
        """Create a wallet for an email user.
        
        Args:
            wallet_client: EVM wallet client
            parameters: Email user wallet creation parameters
        
        Returns:
            Created wallet details
        """
        try:
            response = self.api_client.create_wallet_for_email(
                parameters.email,
                parameters.chain
            )
            return WalletResponse(**response)
        except Exception as error:
            raise Exception(f"Failed to create wallet for email user: {error}")

    @Tool({
        "description": "Get wallet by Twitter username",
        "parameters_schema": GetWalletByTwitterUsernameParameters
    })
    def get_wallet_by_twitter_username(self, wallet_client: EVMWalletClient, parameters: GetWalletByTwitterUsernameParameters) -> WalletResponse:
        """Get wallet details by Twitter username.
        
        Args:
            wallet_client: EVM wallet client
            parameters: Parameters containing Twitter username and chain
        
        Returns:
            Wallet details
        """
        try:
            response = self.api_client.get_wallet_by_twitter_username(
                parameters.username,
                parameters.chain
            )
            return WalletResponse(**response)
        except Exception as error:
            raise Exception(f"Failed to get wallet by Twitter username: {error}")

    @Tool({
        "description": "Get wallet by email",
        "parameters_schema": GetWalletByEmailParameters
    })
    def get_wallet_by_email(self, wallet_client: EVMWalletClient, parameters: GetWalletByEmailParameters) -> WalletResponse:
        """Get wallet details by email.
        
        Args:
            wallet_client: EVM wallet client
            parameters: Parameters containing email and chain
        
        Returns:
            Wallet details
        """
        try:
            response = self.api_client.get_wallet_by_email(
                parameters.email,
                parameters.chain
            )
            return WalletResponse(**response)
        except Exception as error:
            raise Exception(f"Failed to get wallet by email: {error}")

    @Tool({
        "description": "Request tokens from faucet",
        "parameters_schema": RequestFaucetTokensParameters
    })
    def request_faucet_tokens(self, wallet_client: EVMWalletClient, parameters: dict) -> dict:
        """Request tokens from faucet for EVM chains.
        
        Args:
            wallet_client: EVM wallet client
            parameters: Parameters containing wallet address and chain ID
        
        Returns:
            Faucet request response
        """
        try:
            return self.api_client.request_faucet_tokens(
                parameters["wallet_address"],
                parameters["chain_id"]
            )
        except Exception as error:
            raise Exception(f"Failed to request faucet tokens: {error}")
