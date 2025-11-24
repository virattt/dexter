from typing import TypedDict, Literal, Union

class NativeCurrency(TypedDict):
    """Native currency type definition
    
    Args:
        name: Currency name
        symbol: Currency symbol
        decimals: Number of decimals
    """
    name: str
    symbol: str
    decimals: int

class EvmChain(TypedDict):
    """EVM chain type definition
    
    Args:
        type: Literal "evm" chain type identifier
        id: Chain ID number for EVM networks
        nativeCurrency: Native currency information
    """
    type: Literal["evm"]
    id: int
    nativeCurrency: NativeCurrency

class SolanaChain(TypedDict):
    """Solana chain type definition
    
    Args:
        type: Literal "solana" chain type identifier
        nativeCurrency: Native currency information
    """
    type: Literal["solana"]
    nativeCurrency: NativeCurrency

class AptosChain(TypedDict):
    """Aptos chain type definition
    
    Args:
        type: Literal "aptos" chain type identifier
    """
    type: Literal["aptos"]

class ChromiaChain(TypedDict):
    """Chromia chain type definition
    
    Args:
        type: Literal "chromia" chain type identifier
    """
    type: Literal["chromia"]

class MultiversXChain(TypedDict):
    """MultiversX chain type definition
    
    Args:
        type: Literal "multiversx" chain type identifier
    """
    type: Literal["multiversx"]

Chain = Union[EvmChain, SolanaChain, AptosChain, ChromiaChain, MultiversXChain]