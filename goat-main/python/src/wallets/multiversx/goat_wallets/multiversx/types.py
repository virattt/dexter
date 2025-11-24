from typing import TypedDict, List, Any
from typing_extensions import NotRequired


class MultiversXTransaction(TypedDict):
    receiver: str
    native_amount: NotRequired[int]  # Using int for bigint
    esdt_amount: NotRequired[str]
    gas_limit: NotRequired[int]
    chain_id: NotRequired[str]
    function: NotRequired[str]
    contract: NotRequired[Any]
    arguments: NotRequired[List[Any]]
    token_identifier: NotRequired[str]
    data: NotRequired[bytes]


class MultiversXTransactionStatus(TypedDict):
    status: str
    is_completed: str
    is_successful: str
