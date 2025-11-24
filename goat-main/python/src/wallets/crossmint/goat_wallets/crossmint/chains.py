from typing import Dict, List, Literal, Optional, Set, Union, Any
from goat import Chain

# Define chain types
ChainType = Literal[
    'ethereum',
    'ethereum-sepolia',
    'polygon',
    'polygon-amoy',
    'base',
    'base-sepolia',
    'optimism',
    'optimism-sepolia',
    'arbitrum',
    'arbitrum-sepolia',
    'avalanche',
    'avalanche-fuji',
    'mode',
    'mode-sepolia',
    'bsc',
    'chiliz',
    'chiliz-spicy-testnet',
    'story-mainnet',
    'story-testnet',
    'skale-nebula',
    'skale-nebula-testnet',
    'shape',
    'shape-sepolia',
    'astar-zkevm',
    'zkyoto',
    'xai',
    'xai-sepolia-testnet',
    'zora',
    'zora-sepolia',
    'viction-testnet',
    'soneium-minato-testnet'
]

# List of chains that support faucet functionality
FAUCET_CHAINS = [
    "arbitrum-sepolia",
    "avalanche-fuji",
    "base-sepolia",
    "ethereum-sepolia",
    "optimism-sepolia",
    "polygon-amoy",
    "skale-nebula-testnet",
    "viction-testnet",
]

# List of chains that support smart wallet functionality
SMART_WALLET_CHAINS = [
    "polygon",
    "polygon-amoy",
    "base",
    "base-sepolia",
    "arbitrum",
    "arbitrum-sepolia",
    "mode",
    "mode-sepolia",
    "optimism",
    "optimism-sepolia",
]

# List of chains that support minting functionality
MINTING_CHAINS = [
    "arbitrum",
    "arbitrum-sepolia",
    "astar-zkevm",
    "avalanche",
    "avalanche-fuji",
    "base",
    "base-sepolia",
    "bsc",
    "chiliz",
    "chiliz-spicy-testnet",
    "ethereum",
    "ethereum-sepolia",
    "mode",
    "mode-sepolia",
    "optimism",
    "optimism-sepolia",
    "polygon",
    "polygon-amoy",
    "shape",
    "shape-sepolia",
    "skale-nebula",
    "skale-nebula-testnet",
    "story-mainnet",
    "story-testnet",
    "soneium-minato-testnet",
    "xai",
    "xai-sepolia-testnet",
    "zkyoto",
    "zora",
    "zora-sepolia",
]

# Mapping of chain names to their respective chain IDs
CHAIN_MAP: Dict[str, Dict[str, Any]] = {
    "ethereum": {"id": 1},
    "ethereum-sepolia": {"id": 11155111},
    "polygon": {"id": 137},
    "polygon-amoy": {"id": 80002},
    "base": {"id": 8453},
    "base-sepolia": {"id": 84532},
    "optimism": {"id": 10},
    "optimism-sepolia": {"id": 11155420},
    "arbitrum": {"id": 42161},
    "arbitrum-sepolia": {"id": 421614},
    "avalanche": {"id": 43114},
    "avalanche-fuji": {"id": 43113},
    "mode": {"id": 34443},
    "mode-sepolia": {"id": 919},
    "bsc": {"id": 56},
    "chiliz": {"id": 88888},
    "chiliz-spicy-testnet": {"id": 88882},
    "story-mainnet": {"id": 0}, # Placeholder, replace with actual ID
    "story-testnet": {"id": 0}, # Placeholder, replace with actual ID
    "skale-nebula": {"id": 1482601649},
    "skale-nebula-testnet": {"id": 503129905},
    "shape": {"id": 106},
    "shape-sepolia": {"id": 103},
    "astar-zkevm": {"id": 3776},
    "zkyoto": {"id": 6038361},
    "xai": {"id": 660},
    "xai-sepolia-testnet": {"id": 37714555},
    "zora": {"id": 7777777},
    "zora-sepolia": {"id": 999999999},
    "viction-testnet": {"id": 89},
    "soneium-minato-testnet": {"id": 88882}
}

# Cache sets of chain IDs for faster lookups
_faucet_chain_ids: Set[int] = set(CHAIN_MAP[chain]["id"] for chain in FAUCET_CHAINS)
_minting_chain_ids: Set[int] = set(CHAIN_MAP[chain]["id"] for chain in MINTING_CHAINS)
_smart_wallet_chain_ids: Set[int] = set(CHAIN_MAP[chain]["id"] for chain in SMART_WALLET_CHAINS)

def is_story_chain(chain: str) -> bool:
    """Check if a chain is a Story chain.
    
    Args:
        chain: Chain identifier to check
        
    Returns:
        bool: True if chain is a Story chain, False otherwise
    """
    return chain in ["story-mainnet", "story-testnet"]

def get_crossmint_chain_string(chain: Chain) -> str:
    """Convert a GOAT chain to Crossmint chain string.
    
    Args:
        chain: GOAT chain object
        
    Returns:
        str: Crossmint chain string
    """
    if chain["type"] == "solana":
        return "solana"
    if chain["type"] == "aptos":
        return "aptos"
    
    if chain["type"] == "evm":
        # Find chain name by ID
        for chain_name, chain_info in CHAIN_MAP.items():
            if chain_info["id"] == chain["id"]:
                return chain_name
        
        raise ValueError(f"Unsupported chain ID: {chain['id']}")
    
    raise ValueError(f"Unsupported chain type: {chain['type']}")

def is_chain_supported_by_faucet(chain_id: int) -> bool:
    """Check if a chain ID is supported by the faucet.
    
    Args:
        chain_id: Chain ID to check
        
    Returns:
        bool: True if chain ID is supported by the faucet, False otherwise
    """
    return chain_id in _faucet_chain_ids

def is_chain_supported_by_minting(chain_id: int) -> bool:
    """Check if a chain ID is supported by minting.
    
    Args:
        chain_id: Chain ID to check
        
    Returns:
        bool: True if chain ID is supported by minting, False otherwise
    """
    return chain_id in _minting_chain_ids

def is_chain_supported_by_smart_wallet(chain_id: int) -> bool:
    """Check if a chain ID is supported by smart wallets.
    
    Args:
        chain_id: Chain ID to check
        
    Returns:
        bool: True if chain ID is supported by smart wallets, False otherwise
    """
    return chain_id in _smart_wallet_chain_ids 