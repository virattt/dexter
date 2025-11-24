from typing import Any, Dict, Optional, List, Union, cast
from goat_wallets.crossmint.types import SupportedToken
from goat_wallets.crossmint.chains import is_story_chain
from .parameters import (
    SignTypedDataRequest, AdminSigner, Call, WalletType,
    SolanaSmartWalletTransactionParams, DelegatedSignerPermission
)
import requests
import json
from urllib.parse import quote
import time
from goat_wallets.evm import EVMTypedData


class CrossmintWalletsAPI:
    """Python implementation of CrossmintWalletsAPI."""

    def __init__(self, api_key: str, base_url: str = "https://staging.crossmint.com"):
        """Initialize the Crossmint Wallets API client.

        Args:
            api_key: API key for authentication
            base_url: Base URL for the Crossmint API
        """
        self.api_key = api_key
        self.base_url = f"{base_url}/api/v1-alpha2"

    def _request(
        self,
        endpoint: str,
        method: str = "GET",
        timeout: Optional[float] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Make an HTTP request to the Crossmint API.

        Args:
            endpoint: API endpoint (relative to base_url)
            method: HTTP method to use
            timeout: Optional request timeout in seconds
            **kwargs: Additional arguments to pass to requests

        Returns:
            Parsed JSON response

        Raises:
            Exception: If the response is not OK
        """
        url = f"{self.base_url}{endpoint}"
        headers = {
            "x-api-key": self.api_key,
            "Content-Type": "application/json",
            **(kwargs.pop("headers", {}))
        }

        try:
            kwargs["timeout"] = timeout if timeout is not None else 30
            response = requests.request(method, url, headers=headers, **kwargs)
            response_body = response.json()

            if not response.ok:
                error_message = f"Error {response.status_code}: {response.reason}"
                if response_body:
                    error_message += f"\n\n{json.dumps(response_body, indent=2)}"
                raise Exception(error_message)

            return response_body
        except Exception as e:
            raise Exception(f"Failed to {method.lower()} {endpoint}: {e}")

    def create_smart_wallet(
        self,
        wallet_type: WalletType,
        admin_signer: Optional[AdminSigner] = None,
        linked_user: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a new smart wallet.

        Args:
            wallet_type: Type of smart wallet (EVM_SMART_WALLET or SOLANA_SMART_WALLET)
            admin_signer: Optional admin signer configuration
            linked_user: Linked user locator

        Returns:
            Wallet creation response

        Raises:
            ValueError: If no user locator is provided
        """

        payload = {
            "type": wallet_type.value,
            "config": {
                "adminSigner": admin_signer.model_dump() if admin_signer else None
            },
        }
        if linked_user:
            payload["linkedUser"] = linked_user

        if admin_signer:
            payload["config"]["adminSigner"] = admin_signer.model_dump()

        return self._request("/wallets", method="POST", json=payload)

    def create_custodial_wallet(self, linked_user: str) -> Dict[str, Any]:
        """Create a new Solana custodial wallet.

        Args:
            linked_user: User identifier (email, phone, or userId)

        Returns:
            Wallet creation response
        """
        # Format linkedUser based on type
        if "@" in linked_user:
            linked_user = f"email:{linked_user}"
        elif linked_user.startswith("+"):
            linked_user = f"phoneNumber:{linked_user}"
        else:
            linked_user = f"userId:{linked_user}"

        payload = {
            "type": "solana-mpc-wallet",
            "linkedUser": linked_user
        }

        return self._request("/wallets", method="POST", json=payload)

    def get_wallet(self, locator: str) -> Dict[str, Any]:
        """Get wallet details by locator.

        Args:
            locator: Wallet locator string

        Returns:
            Wallet details
        """
        endpoint = f"/wallets/{quote(locator)}"
        return self._request(endpoint)

    def sign_message_for_custodial_wallet(
        self, locator: str, message: str
    ) -> Dict[str, Any]:
        """Sign a message using a Solana custodial wallet.

        Args:
            locator: Wallet locator string
            message: Message to sign

        Returns:
            Signature response
        """
        endpoint = f"/wallets/{quote(locator)}/signatures"
        payload = {
            "type": "solana-message",
            "params": {"message": message}
        }

        return self._request(endpoint, method="POST", json=payload)

    def sign_message_for_smart_wallet(
        self,
        wallet_address: str,
        message: str,
        chain: str,
        signer: Optional[str] = None,
        required_signers: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Sign a message using a smart wallet.

        Args:
            wallet_address: Wallet address
            message: Message to sign
            chain: Chain identifier
            signer: Optional signer address
            required_signers: Optional list of additional required signers

        Returns:
            Signature response
        """
        endpoint = f"/wallets/{quote(wallet_address)}/signatures"

        if chain == "solana":
            payload = {
                "type": "solana-message",
                "params": {
                    "message": message,
                    "requiredSigners": required_signers,
                    "signer": signer
                }
            }
        else:
            payload = {
                "type": "evm-message",
                "params": {
                    "message": message,
                    "signer": signer,
                    "chain": chain
                }
            }

        payload["params"] = {k: v for k,
                             v in payload["params"].items() if v is not None}
        return self._request(endpoint, method="POST", json=payload)

    def sign_typed_data_for_smart_wallet(
        self,
        wallet_address: str,
        typed_data: EVMTypedData,
        chain: str,
        signer: str
    ) -> Dict[str, Any]:
        """Sign typed data using an EVM smart wallet.

        Args:
            wallet_address: Wallet address
            typed_data: EVM typed data to sign
            chain: Chain identifier
            signer: Signer address

        Returns:
            Signature response
        """
        endpoint = f"/wallets/{quote(wallet_address)}/signatures"
        payload = SignTypedDataRequest(
            type="evm-typed-data",
            params={
                "typedData": typed_data,
                "chain": chain,
                "signer": signer
            }
        ).model_dump()

        return self._request(endpoint, method="POST", json=payload)

    def check_signature_status(
        self, signature_id: str, wallet_address: str
    ) -> Dict[str, Any]:
        """Check the status of a signature request.

        Args:
            signature_id: ID of the signature request
            wallet_address: Address of the wallet

        Returns:
            Signature status response
        """
        endpoint = f"/wallets/{quote(wallet_address)}/signatures/{quote(signature_id)}"
        return self._request(endpoint)

    def approve_signature_for_smart_wallet(
        self,
        signature_id: str,
        locator: str,
        signer: Optional[str] = None,
        signature: Optional[str] = None,
        approvals: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """Approve a signature request for a smart wallet.

        Args:
            signature_id: ID of the signature request
            locator: Wallet locator string
            signer: Optional signer identifier
            signature: Optional signature value
            approvals: Optional list of approval objects with signer and signature

        Returns:
            Approval response
        """
        endpoint = f"/wallets/{quote(locator)}/signatures/{quote(signature_id)}/approve"
        payload = {}

        if approvals:
            endpoint = f"/wallets/{quote(locator)}/signatures/{quote(signature_id)}/approvals"
            payload = {"approvals": approvals}
        else:
            if signature:
                payload["signature"] = signature
            if signer:
                payload["signer"] = signer

        return self._request(endpoint, method="POST", json=payload)

    def create_transaction_for_custodial_wallet(
        self, locator: str, transaction: str
    ) -> Dict[str, Any]:
        """Create a transaction using a Solana custodial wallet.

        Args:
            locator: Wallet locator string (email:address, phoneNumber:address, or userId:address)
            transaction: Encoded transaction data

        Returns:
            Transaction creation response
        """
        # Format locator to use correct wallet type
        endpoint = f"/wallets/{quote(locator)}/transactions"
        payload = {
            "params": {
                "transaction": transaction
            }
        }

        return self._request(endpoint, method="POST", json=payload)

    def create_transaction(
        self,
        wallet_locator: str,
        transaction: str,
        signer: Optional[str] = None,
        required_signers: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Create a new Solana transaction.

        Args:
            wallet_locator: Wallet identifier
            transaction: Base58 encoded serialized Solana transaction
            required_signers: Optional list of additional required signers
            signer: Optional signer locator (defaults to admin signer)

        Returns:
            Transaction creation response
        """
        endpoint = f"/wallets/{quote(wallet_locator)}/transactions"
        payload = {
            "params": {
                "transaction": transaction,
                "requiredSigners": required_signers,
                "signer": signer
            }
        }
        payload["params"] = {k: v for k,
                             v in payload["params"].items() if v is not None}

        return self._request(endpoint, method="POST", json=payload)

    def create_transaction_for_smart_wallet(
        self,
        wallet_address: str,
        params: Union[List[Call], SolanaSmartWalletTransactionParams],
        chain: Optional[str] = None,
        signer: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a transaction using a smart wallet.

        Args:
            wallet_address: Wallet address
            params: Transaction parameters (List[Call] for EVM, SolanaSmartWalletTransactionParams for Solana)
            chain: Chain identifier (required for EVM)
            signer: Optional signer address (for EVM only)

        Returns:
            Transaction creation response
        """
        if isinstance(params, list):
            if not chain:
                raise ValueError(
                    "Chain identifier is required for EVM transactions")
            return self.create_transaction_for_evm_smart_wallet(wallet_address, cast(List[Call], params), chain, signer)
        else:
            return self.create_transaction(
                wallet_address,
                params.transaction,
                params.signer,
                params.required_signers,
            )

    def create_transaction_for_evm_smart_wallet(
        self,
        wallet_address: str,
        calls: List[Call],
        chain: str,
        signer: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a transaction using an EVM smart wallet.

        Args:
            wallet_address: Wallet address
            calls: List of contract calls or dictionaries
            chain: Chain identifier
            signer: Optional signer address

        Returns:
            Transaction creation response
        """
        endpoint = f"/wallets/{quote(wallet_address)}/transactions"

        # Convert dictionaries to Call models if needed
        formatted_calls = []
        for call in calls:
            if isinstance(call, dict):
                formatted_calls.append(Call(**call).model_dump())
            else:
                formatted_calls.append(call.model_dump())

        payload = {
            "params": {
                "chain": chain,
                "signer": f"evm-keypair:{signer}" if signer else None,
                "calls": formatted_calls
            }
        }
        if signer:
            payload["params"]["signer"] = f"evm-keypair:{signer}"

        return self._request(endpoint, method="POST", json=payload)

    def approve_transaction(
        self,
        locator: str,
        transaction_id: str,
        approvals: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """Approve a transaction.

        Args:
            locator: Wallet locator string
            transaction_id: ID of the transaction
            approvals: List of approval objects or AdminSigner instances

        Returns:
            Approval response
        """
        endpoint = f"/wallets/{quote(locator)}/transactions/{quote(transaction_id)}/approvals"

        payload = {"approvals": approvals}

        return self._request(endpoint, method="POST", json=payload)

    def check_transaction_status(
        self, locator: str, transaction_id: str
    ) -> Dict[str, Any]:
        """Check the status of a transaction.

        Args:
            locator: Wallet locator string
            transaction_id: ID of the transaction

        Returns:
            Transaction status response
        """
        endpoint = f"/wallets/{quote(locator)}/transactions/{quote(transaction_id)}"
        return self._request(endpoint)

    def get_endpoint_root(self, chain: str) -> str:
        """Get the appropriate endpoint root based on chain type.
        
        Args:
            chain: Chain identifier
            
        Returns:
            str: API endpoint root path
        """
        return "/api/v1/ip" if is_story_chain(chain) else "/api/2022-06-09"

    def create_collection(self, parameters: Dict[str, Any], chain: str) -> Dict[str, Any]:
        """Create a new NFT collection.

        Args:
            parameters: Collection parameters
            chain: Chain identifier

        Returns:
            Collection creation response
        """
        endpoint_root = self.get_endpoint_root(chain)
        endpoint = f"{endpoint_root}/collections"
        
        payload = {
            **parameters,
            "chain": chain
        }
        
        return self._request(endpoint, method="POST", json=payload)

    def get_all_collections(self, chain: Optional[str] = None) -> Dict[str, Any]:
        """Get all collections created by the user.
        
        Args:
            chain: Optional chain identifier to filter collections
        

        Returns:
            Collections response
        """
        endpoint_root = self.get_endpoint_root(chain) if chain else "/api/2022-06-09"
        endpoint = f"{endpoint_root}/collections/"
        
        return self._request(endpoint)

    def mint_nft(
        self, 
        collection_id: str, 
        recipient: str, 
        metadata: Dict[str, Any],
        chain: Optional[str] = None
    ) -> Dict[str, Any]:
        """Mint an NFT to a recipient.
        
        Args:
            collection_id: ID of the collection to mint in
            recipient: Recipient identifier (formatted as email:address:chain or chain:address)
            metadata: NFT metadata
            chain: Optional chain identifier
        
        Returns:
            Minting response
        """
        endpoint_root = self.get_endpoint_root(chain) if chain else "/api/2022-06-09"
        endpoint_ending = "/ipass" if chain in ["story-mainnet", "story-testnet"] else "/nfts"
        endpoint = f"{endpoint_root}/collections/{collection_id}{endpoint_ending}"
        
        payload = {
            "recipient": recipient,
            "metadata": metadata
        }
        
        return self._request(endpoint, method="POST", json=payload)

    def create_wallet_for_twitter(self, username: str, chain: str) -> Dict[str, Any]:
        """Create a wallet for a Twitter user.

        Args:
            username: Twitter username
            chain: Chain identifier

        Returns:
            Created wallet details
        """
        endpoint = "/wallets"
        payload = {
            "type": f"{chain}-mpc-wallet",
            "linkedUser": f"x:{username}"
        }
        return self._request(endpoint, method="POST", json=payload)

    def create_wallet_for_email(self, email: str, chain: str) -> Dict[str, Any]:
        """Create a wallet for an email user.

        Args:
            email: Email address
            chain: Chain identifier

        Returns:
            Created wallet details
        """
        endpoint = "/wallets"
        payload = {
            "type": f"{chain}-mpc-wallet",
            "linkedUser": f"email:{email}"
        }
        return self._request(endpoint, method="POST", json=payload)

    def get_wallet_by_twitter_username(self, username: str, chain: str) -> Dict[str, Any]:
        """Get wallet details by Twitter username.

        Args:
            username: Twitter username
            chain: Chain identifier

        Returns:
            Wallet details
        """
        endpoint = f"/wallets/x:{username}:{chain}-mpc-wallet"
        return self._request(endpoint)

    def get_wallet_by_email(self, email: str, chain: str, timeout: Optional[float] = None) -> Dict[str, Any]:
        """Get wallet details by email.

        Args:
            email: Email address
            chain: Chain identifier
            timeout: Optional request timeout in seconds

        Returns:
            Wallet details
        """
        locator = f"email:{email}:{chain}-mpc-wallet"
        endpoint = f"/wallets/{quote(locator)}"
        return self._request(endpoint, timeout=timeout)

    def fund_wallet(self, wallet_locator: str, token: SupportedToken, amount: int, chain: Optional[str] = None) -> Dict[str, Any]:
        """Fund a wallet with a specified amount of this token.

                Args:
                    wallet_address: Wallet address
                    token: Token to fund
                    amount: Amount of token to fund
                    chain: Chain to fund the wallet on

                Returns:
                    Fund request response
                """
        endpoint = f"/wallets/{quote(wallet_locator)}/balances"
        payload = {
            "amount": amount,
            "token": token,
        }
        if chain:
            payload["chain"] = chain
        print(f"Payload: {payload}")
        return self._request(endpoint, method="POST", json=payload)

    def request_faucet_tokens(self, wallet_address: str, chain_id: str) -> Dict[str, Any]:
        """Request tokens from faucet.

        Args:
            wallet_address: Wallet address
            chain_id: Chain identifier

        Returns:
            Faucet request response
        """
        endpoint = f"/wallets/{quote(wallet_address)}/balances"
        payload = {
            "amount": 10,
            "currency": "usdc",
            "chain": chain_id
        }
        return self._request(endpoint, method="POST", json=payload)

    def register_delegated_signer(
        self,
        wallet_locator: str,
        signer: str,
        chain: Optional[str] = None,  # Only for EVM
        expires_at: Optional[int] = None,  # Only for EVM
        # Only for EVM
        permissions: Optional[List[DelegatedSignerPermission]] = None
    ) -> Dict[str, Any]:
        """Register a delegated signer for a smart wallet.

        Args:
            wallet_locator: Wallet identifier
            signer: The locator of the delegated signer
            chain: Optional chain identifier
            expires_at: Optional expiry date in milliseconds since UNIX epoch
            permissions: Optional list of ERC-7715 permission objects

        Returns:
            Delegated signer registration response
        """
        endpoint = f"/wallets/{quote(wallet_locator)}/signers"
        payload: Dict[str, Any] = {
            "signer": signer,
        }

        if chain:
            payload["chain"] = chain
        if expires_at:
            payload["expiresAt"] = str(expires_at)
        if permissions:
            payload["permissions"] = [
                {"type": p.type, "value": p.value} for p in permissions]

        return self._request(endpoint, method="POST", json=payload)

    def get_balance(self, wallet_locator: str, tokens: List[SupportedToken], chains: List[str] | None = None) -> Dict[str, Any]:
        """Get the balance of a wallet for a specific token.

        Args:
            wallet_locator: Wallet identifier
            tokens: List of token identifiers
            chains: List of chain identifiers

        Returns:

            List[{
                "token":    token,
                "decimals": int,
                "balances": {
                    <chain_1>: int,
                    <chain_2>: int,
                    ...
                    "total": int
                }
            }]
        """
        query_params = {
            "tokens": ",".join(tokens),
        }
        if chains:
            query_params["chains"] = ",".join(chains)

        endpoint = f"/wallets/{quote(wallet_locator)}/balances"
        return self._request(endpoint, method="GET", params=query_params)

    def get_delegated_signer(
        self,
        wallet_locator: str,
        signer_locator: str
    ) -> Dict[str, Any]:
        """Get information about a delegated signer.

        Args:
            wallet_locator: Wallet identifier
            signer_locator: Signer locator string

        Returns:
            Delegated signer information
        """
        endpoint = f"/wallets/{quote(wallet_locator)}/signers/{quote(signer_locator)}"
        return self._request(endpoint, method="GET")

    def wait_for_action(self, action_id: str, interval: float = 1.0, max_attempts: int = 60) -> Dict[str, Any]:
        """Wait for an action to complete.

        Args:
            action_id: Action ID to wait for
            interval: Time to wait between attempts in seconds
            max_attempts: Maximum number of attempts to check status

        Returns:
            Action response when completed

        Raises:
            Exception: If action times out or fails
        """
        attempts = 0
        while attempts < max_attempts:
            attempts += 1
            endpoint = f"/actions/{quote(action_id)}"
            response = self._request(endpoint)

            if response.get("status") == "succeeded":
                return response

            time.sleep(interval)

        raise Exception("Timed out waiting for action")

    def wait_for_transaction(self, locator: str, transaction_id: str, interval: float = 1.0, max_attempts: int = 60) -> Dict[str, Any]:
        """Wait for a transaction to complete.

        Args:
            locator: Wallet locator string
            transaction_id: Transaction ID to wait for
            interval: Time to wait between attempts in seconds
            max_attempts: Maximum number of attempts to check status

        Returns:
            Transaction response when completed

        Raises:
            Exception: If transaction times out or fails
        """
        attempts = 0
        while attempts < max_attempts:
            attempts += 1
            response = self.check_transaction_status(locator, transaction_id)

            if response["status"] in ["success", "completed", "failed"]:
                return response

            time.sleep(interval)

        raise Exception("Timed out waiting for transaction")

    def wait_for_signature(self, locator: str, signature_id: str, interval: float = 1.0, max_attempts: int = 60) -> Dict[str, Any]:
        """Wait for a signature request to complete.

        Args:
            locator: Wallet locator string
            signature_id: Signature ID to wait for
            interval: Time to wait between attempts in seconds
            max_attempts: Maximum number of attempts to check status

        Returns:
            Signature response when completed

        Raises:
            Exception: If signature request times out or fails
        """
        attempts = 0
        while attempts < max_attempts:
            attempts += 1
            response = self.check_signature_status(signature_id, locator)

            if response["status"] in ["success", "completed", "failed"]:
                return response

            time.sleep(interval)

        raise Exception("Timed out waiting for signature")

    def create_wallet(self, wallet_type: str, linked_user: Optional[str] = None, config: Optional[Dict[str, Any]] = None, idempotency_key: Optional[str] = None) -> Dict[str, Any]:
        """Create a new wallet.

        Args:
            wallet_type: Type of wallet to create
            linked_user: Optional user identifier to link the wallet to
            config: Optional wallet configuration

        Returns:
            Created wallet details
        """
        payload: Dict[str, Any] = {
            "type": wallet_type,
        }
        headers = {}
        if linked_user:
            payload["linkedUser"] = linked_user
        if config:
            payload["config"] = config
        if idempotency_key:
            headers["x-idempotency-key"] = idempotency_key
        return self._request("/wallets", method="POST", json=payload, headers=headers)

    def create_wallet_for_phone(self, phone: str, chain: str) -> Dict[str, Any]:
        """Create a wallet for a phone number.

        Args:
            phone: Phone number
            chain: Chain identifier

        Returns:
            Created wallet details
        """
        return self.create_wallet(
            wallet_type=f"{chain}-mpc-wallet",
            linked_user=f"phone:{phone}"
        )

    def create_wallet_for_user_id(self, user_id: str, chain: str) -> Dict[str, Any]:
        """Create a wallet for a user ID.

        Args:
            user_id: User identifier
            chain: Chain identifier

        Returns:
            Created wallet details
        """
        return self.create_wallet(
            wallet_type=f"{chain}-mpc-wallet",
            linked_user=f"userId:{user_id}"
        )
