from pydantic import BaseModel, Field
from typing import List

class JSONRpcBodyParameters(BaseModel):
    method: str = Field(
        ...,
        description="A string containing the name of the method to be invoked"
    )
    params: List[str] = Field(
        ...,
        description="A structured value that holds the parameter value to be used during the invokation of the method"
    )
    id: int = Field(
        ...,
        description="An identifier established by the client that must contain a string number or null"
    )
    jsonrpc: str = Field(
        ...,
        description="A string that specifies the version of the JSON-RPC protocol must be exactly '2.0'"
    )
