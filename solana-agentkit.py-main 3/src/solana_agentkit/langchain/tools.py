from typing import Optional, Dict, Any, List
from langchain.tools import Tool
import json
from rsa import PublicKey
from solana_agentkit.agent.solana_agent import PumpFunTokenOptions
from ..utils.toJSON import parse_json_input
from ..agent.base import BaseSolanaAgent

class SolanaBalanceTool(Tool):
    """Tool for checking Solana wallet or token account balances."""
    
    def __init__(self, solana_kit: BaseSolanaAgent):
        """Initialize the balance tool.
        
        Args:
            solana_kit: Instance of SolanaAgentKit
        """
        super().__init__(
            name="solana_balance",
            description="""Get the balance of a Solana wallet or token account.
            
            If you want to get the balance of your wallet, you don't need to provide the tokenAddress.
            If no tokenAddress is provided, the balance will be in SOL.
            
            Inputs:
            tokenAddress: string, eg "So11111111111111111111111111111111111111112" (optional)""",
            func=self._run
        )
        self.solana_kit = solana_kit

    async def _run(self, input_str: str) -> str:
        """Execute the balance check.
        
        Args:
            input_str: Optional token address
            
        Returns:
            JSON string with balance information
        """
        try:
            token_address = PublicKey(input_str) if input_str else None
            balance = await self.solana_kit.get_balance(token_address)
            
            return json.dumps({
                "status": "success",
                "balance": balance,
                "token": input_str or "SOL"
            })
        except Exception as error:
            return json.dumps({
                "status": "error",
                "message": str(error),
                "code": getattr(error, 'code', 'UNKNOWN_ERROR')
            })

class SolanaTransferTool(Tool):
    """Tool for transferring SOL or tokens between addresses."""
    
    def __init__(self, solana_kit: BaseSolanaAgent):
        """Initialize the transfer tool.
        
        Args:
            solana_kit: Instance of SolanaAgentKit
        """
        super().__init__(
            name="solana_transfer",
            description="""Transfer tokens or SOL to another address (also called as wallet address).
            
            Inputs (input is a JSON string):
            to: string, eg "8x2dR8Mpzuz2YqyZyZjUbYWKSWesBo5jMx2Q9Y86udVk" (required)
            amount: number, eg 1 (required)
            mint?: string, eg "So11111111111111111111111111111111111111112" (optional)""",
            func=self._run
        )
        self.solana_kit = solana_kit

    async def _run(self, input_str: str) -> str:
        """Execute the transfer.
        
        Args:
            input_str: JSON string with transfer parameters
            
        Returns:
            JSON string with transfer result
        """
        try:
            params = parse_json_input(input_str)
            recipient = PublicKey(params['to'])
            mint_address = PublicKey(params['mint']) if params.get('mint') else None
            
            tx = await self.solana_kit.transfer(
                recipient,
                params['amount'],
                mint_address
            )
            
            return json.dumps({
                "status": "success",
                "message": "Transfer completed successfully",
                "amount": params['amount'],
                "recipient": params['to'],
                "token": params.get('mint', 'SOL'),
                "transaction": tx
            })
        except Exception as error:
            return json.dumps({
                "status": "error",
                "message": str(error),
                "code": getattr(error, 'code', 'UNKNOWN_ERROR')
            })

class SolanaDeployTokenTool(Tool):
    """Tool for deploying new SPL tokens."""
    
    def __init__(self, solana_kit: BaseSolanaAgent):
        """Initialize the token deployment tool.
        
        Args:
            solana_kit: Instance of SolanaAgentKit
        """
        super().__init__(
            name="solana_deploy_token",
            description="Deploy a new SPL token. Input should be JSON string with: {decimals?: number, initialSupply?: number}",
            func=self._run
        )
        self.solana_kit = solana_kit

    def _validate_input(self, input_data: Dict[str, Any]) -> None:
        """Validate token deployment parameters.
        
        Args:
            input_data: Dictionary of deployment parameters
            
        Raises:
            ValueError: If parameters are invalid
        """
        if 'decimals' in input_data:
            if not isinstance(input_data['decimals'], int) or not 0 <= input_data['decimals'] <= 9:
                raise ValueError("decimals must be a number between 0 and 9")
                
        if 'initialSupply' in input_data:
            if not isinstance(input_data['initialSupply'], (int, float)) or input_data['initialSupply'] <= 0:
                raise ValueError("initialSupply must be a positive number")

    async def _run(self, input_str: str) -> str:
        """Execute token deployment.
        
        Args:
            input_str: JSON string with deployment parameters
            
        Returns:
            JSON string with deployment result
        """
        try:
            params = parse_json_input(input_str)
            self._validate_input(params)
            
            result = await self.solana_kit.deploy_token(
                decimals=params.get('decimals', 9)
            )
            
            return json.dumps({
                "status": "success",
                "message": "Token deployed successfully",
                "mintAddress": str(result['mint']),
                "decimals": params.get('decimals', 9)
            })
        except Exception as error:
            return json.dumps({
                "status": "error",
                "message": str(error),
                "code": getattr(error, 'code', 'UNKNOWN_ERROR')
            })

class SolanaRequestFundsTool(Tool):
    """Tool for requesting SOL from faucet."""
    
    def __init__(self, solana_kit: BaseSolanaAgent):
        """Initialize the funds request tool.
        
        Args:
            solana_kit: Instance of SolanaAgentKit
        """
        super().__init__(
            name="solana_request_funds",
            description="Request SOL from faucet",
            func=self._run
        )
        self.solana_kit = solana_kit

    async def _run(self, input_str: str) -> str:
        """Execute the funds request.
        
        Args:
            input_str: Ignored
            
        Returns:
            JSON string with request result
        """
        try:
            tx = await self.solana_kit.request_funds()
            
            return json.dumps({
                "status": "success",
                "message": "Funds requested successfully",
                "transaction": tx
            })
        except Exception as error:
            return json.dumps({
                "status": "error",
                "message": str(error),
                "code": getattr(error, 'code', 'UNKNOWN_ERROR')
            })

class SolanaDeployCollectionTool(Tool):
    """Tool for deploying NFT collections on Solana."""

    def __init__(self, solana_kit: BaseSolanaAgent):
        super().__init__(
            name="solana_deploy_collection",
            description="""Deploy a new NFT collection. Input should be JSON with: 
            {name: string, uri: string, royaltyBasisPoints?: number, 
            creators?: Array<{address: string, percentage: number}>}""",
            func=self._run
        )
        self.solana_kit = solana_kit

    def _validate_input(self, input_data: Dict[str, Any]) -> None:
        if not input_data.get('name') or not isinstance(input_data['name'], str):
            raise ValueError("name is required and must be a string")
            
        if not input_data.get('uri') or not isinstance(input_data['uri'], str):
            raise ValueError("uri is required and must be a string")
            
        if 'royaltyBasisPoints' in input_data:
            points = input_data['royaltyBasisPoints']
            if not isinstance(points, int) or not 0 <= points <= 10000:
                raise ValueError("royaltyBasisPoints must be between 0 and 10000")
                
        if creators := input_data.get('creators'):
            if not isinstance(creators, list):
                raise ValueError("creators must be an array")
            
            for idx, creator in enumerate(creators):
                if not creator.get('address') or not isinstance(creator['address'], str):
                    raise ValueError(f"creator[{idx}].address must be a valid string")
                if not isinstance(creator.get('percentage'), (int, float)) or not 0 <= creator['percentage'] <= 100:
                    raise ValueError(f"creator[{idx}].percentage must be between 0 and 100")

    async def _run(self, input_str: str) -> str:
        try:
            params = parse_json_input(input_str)
            self._validate_input(params)
            result = await self.solana_kit.deploy_collection(params)
            
            return json.dumps({
                "status": "success",
                "message": "Collection deployed successfully",
                "collectionAddress": str(result['collectionAddress']),
                "name": params['name']
            })
        except Exception as error:
            return json.dumps({
                "status": "error",
                "message": str(error),
                "code": getattr(error, 'code', 'UNKNOWN_ERROR')
            })

class SolanaMintNFTTool(Tool):
    """Tool for minting NFTs in a collection."""

    def __init__(self, solana_kit: BaseSolanaAgent):
        super().__init__(
            name="solana_mint_nft",
            description="""Mint a new NFT in a collection. Input should be JSON with: 
            {collectionMint: string, metadata: {name: string, symbol: string, uri: string}, 
            recipient?: string}""",
            func=self._run
        )
        self.solana_kit = solana_kit

    def _validate_input(self, input_data: Dict[str, Any]) -> None:
        if not input_data.get('collectionMint'):
            raise ValueError("collectionMint is required")
            
        metadata = input_data.get('metadata', {})
        if not isinstance(metadata, dict):
            raise ValueError("metadata must be an object")
            
        required_fields = ['name', 'symbol', 'uri']
        for field in required_fields:
            if not metadata.get(field) or not isinstance(metadata[field], str):
                raise ValueError(f"metadata.{field} is required and must be a string")

    async def _run(self, input_str: str) -> str:
        try:
            params = parse_json_input(input_str)
            self._validate_input(params)
            
            collection_mint = PublicKey(params['collectionMint'])
            recipient = PublicKey(params['recipient']) if params.get('recipient') else None
            
            result = await self.solana_kit.mint_nft(
                collection_mint,
                params['metadata'],
                recipient
            )
            
            return json.dumps({
                "status": "success",
                "message": "NFT minted successfully",
                "mintAddress": str(result['mint']),
                "name": params['metadata']['name'],
                "recipient": params.get('recipient', str(result['mint']))
            })
        except Exception as error:
            return json.dumps({
                "status": "error",
                "message": str(error),
                "code": getattr(error, 'code', 'UNKNOWN_ERROR')
            })

class SolanaTradeTool(Tool):
    """Tool for executing trades using Jupiter aggregator."""

    def __init__(self, solana_kit: BaseSolanaAgent):
        super().__init__(
            name="solana_trade",
            description="""Execute token swaps using Jupiter Exchange.
            
            Inputs (JSON string):
            outputMint: string (required) - Token to receive
            inputAmount: number (required) - Amount to swap
            inputMint?: string (optional) - Token to spend (defaults to SOL)
            slippageBps?: number (optional) - Maximum slippage in basis points""",
            func=self._run
        )
        self.solana_kit = solana_kit

    async def _run(self, input_str: str) -> str:
        try:
            params = parse_json_input(input_str)
            
            output_mint = PublicKey(params['outputMint'])
            input_mint = PublicKey(params.get('inputMint', 'So11111111111111111111111111111111111111112'))
            
            tx = await self.solana_kit.trade(
                output_mint,
                params['inputAmount'],
                input_mint,
                params.get('slippageBps', 50)
            )
            
            return json.dumps({
                "status": "success",
                "message": "Trade executed successfully",
                "transaction": tx,
                "inputAmount": params['inputAmount'],
                "inputToken": params.get('inputMint', 'SOL'),
                "outputToken": params['outputMint']
            })
        except Exception as error:
            return json.dumps({
                "status": "error",
                "message": str(error),
                "code": getattr(error, 'code', 'UNKNOWN_ERROR')
            })

class SolanaRegisterDomainTool(Tool):
    """Tool for registering a domain on Solana."""

    def __init__(self, solana_kit: BaseSolanaAgent):
        super().__init__(
            name="solana_register_domain",
            description="Register a new domain on Solana",
            func=self._run
        )
        self.solana_kit = solana_kit

    async def _run(self, input_str: str) -> str:
        try:
            domain_name = input_str.strip()
            result = await self.solana_kit.register_domain(domain_name)
            
            return json.dumps({
                "status": "success",
                "message": "Domain registered successfully",
                "domain": domain_name,
                "transaction": result
            })
        except Exception as error:
            return json.dumps({
                "status": "error",
                "message": str(error),
                "code": getattr(error, 'code', 'UNKNOWN_ERROR')
            })

class SolanaGetWalletAddressTool(Tool):
    """Tool for retrieving the wallet address."""

    def __init__(self, solana_kit: BaseSolanaAgent):
        super().__init__(
            name="solana_get_wallet_address",
            description="Get the wallet address of the Solana agent",
            func=self._run
        )
        self.solana_kit = solana_kit

    async def _run(self, input_str: str) -> str:
        try:
            wallet_address = str(self.solana_kit.wallet_address)
            
            return json.dumps({
                "status": "success",
                "wallet_address": wallet_address
            })
        except Exception as error:
            return json.dumps({
                "status": "error",
                "message": str(error),
                "code": getattr(error, 'code', 'UNKNOWN_ERROR')
            })

class SolanaPumpfunTokenLaunchTool(Tool):
    """Tool for launching a PumpFun token."""

    def __init__(self, solana_kit: BaseSolanaAgent):
        super().__init__(
            name="solana_pumpfun_token_launch",
            description="Launch a new PumpFun token",
            func=self._run
        )
        self.solana_kit = solana_kit

    async def _run(self, input_str: str) -> str:
        try:
            params = parse_json_input(input_str)
            result = await self.solana_kit.launch_pumpfun_token(
                params['token_name'],
                params['token_ticker'],
                params['description'],
                params['image_url'],
                PumpFunTokenOptions(**params.get('options', {}))
            )
            
            return json.dumps({
                "status": "success",
                "message": "PumpFun token launched successfully",
                "token_name": params['token_name'],
                "token_ticker": params['token_ticker'],
                "transaction": result
            })
        except Exception as error:
            return json.dumps({
                "status": "error",
                "message": str(error),
                "code": getattr(error, 'code', 'UNKNOWN_ERROR')
            })

class SolanaCreateImageTool(Tool):
    """Tool for creating an image."""

    def __init__(self, solana_kit: BaseSolanaAgent):
        super().__init__(
            name="solana_create_image",
            description="Create an image using AI",
            func=self._run
        )
        self.solana_kit = solana_kit

    async def _run(self, input_str: str) -> str:
        try:
            image_description = input_str.strip()
            result = await self.solana_kit.create_image(image_description)
            
            return json.dumps({
                "status": "success",
                "message": "Image created successfully",
                "image_url": result
            })
        except Exception as error:
            return json.dumps({
                "status": "error",
                "message": str(error),
                "code": getattr(error, 'code', 'UNKNOWN_ERROR')
            })

def create_solana_tools(solana_kit: BaseSolanaAgent) -> List[Tool]:
    """Create a complete set of Solana tools for the agent.
    
    Args:
        solana_kit: The Solana agent instance
        
    Returns:
        List of initialized tools
    """
    return [
        SolanaBalanceTool(solana_kit),
        SolanaTransferTool(solana_kit),
        SolanaDeployTokenTool(solana_kit),
        SolanaDeployCollectionTool(solana_kit),
        SolanaMintNFTTool(solana_kit),
        SolanaTradeTool(solana_kit),
        SolanaRequestFundsTool(solana_kit),
        SolanaRegisterDomainTool(solana_kit),
        SolanaGetWalletAddressTool(solana_kit),
        SolanaPumpfunTokenLaunchTool(solana_kit),
        SolanaCreateImageTool(solana_kit)
    ]