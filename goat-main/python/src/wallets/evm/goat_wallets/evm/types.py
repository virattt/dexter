from typing import Any, Dict, List, TypedDict
from typing_extensions import NotRequired

from eth_typing import HexStr

class PaymasterOptions(TypedDict):
    address: str  # hex address
    input: str  # hex input


class EVMTransactionOptions(TypedDict):
    paymaster: NotRequired[PaymasterOptions]


class EVMTransaction(TypedDict):
    to: str
    functionName: NotRequired[str]
    args: NotRequired[List[Any]]
    value: NotRequired[int]  # Using int for bigint
    abi: NotRequired[List[Dict[str, Any]]]  # ABI type
    options: NotRequired[EVMTransactionOptions]
    data: NotRequired[HexStr]


class EVMReadRequest(TypedDict):
    address: str
    functionName: str
    args: NotRequired[List[Any]]
    abi: List[Dict[str, Any]]  # ABI type


class EVMReadResult(TypedDict):
    value: Any


class TypedDataDomain(TypedDict):
    name: NotRequired[str]
    version: NotRequired[str]
    chainId: NotRequired[int]
    verifyingContract: NotRequired[str]
    salt: NotRequired[str]


class EVMTypedData(TypedDict):
    domain: TypedDataDomain
    types: Dict[str, Any]
    primaryType: str
    message: Dict[str, Any]
