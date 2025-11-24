from typing import Dict, Any, Optional, List
import json


def compare_wallet_responses(py_response: Dict[str, Any], ts_response: Dict[str, Any]) -> None:
    """Compare wallet responses between Python and TypeScript implementations.
    
    Args:
        py_response: Response from Python implementation
        ts_response: Response from TypeScript implementation
        
    Raises:
        AssertionError: If responses don't match
    """
    assert py_response["address"] == ts_response["address"], "Wallet addresses don't match"
    assert py_response["type"] == ts_response["type"], "Wallet types don't match"
    
    # Compare optional fields if present
    if "linkedUser" in py_response or "linkedUser" in ts_response:
        assert py_response.get("linkedUser") == ts_response.get("linkedUser"), "Linked users don't match"


def compare_transaction_responses(py_response: Dict[str, Any], ts_response: Dict[str, Any]) -> None:
    """Compare transaction responses between implementations.
    
    Args:
        py_response: Response from Python implementation
        ts_response: Response from TypeScript implementation
        
    Raises:
        AssertionError: If responses don't match
    """
    assert py_response["status"] == ts_response["status"], "Transaction status doesn't match"
    assert py_response.get("hash") == ts_response.get("hash"), "Transaction hash doesn't match"
    
    # Compare onChain data if present
    if "onChain" in py_response or "onChain" in ts_response:
        py_onchain = py_response.get("onChain", {})
        ts_onchain = ts_response.get("onChain", {})
        assert py_onchain.get("txId") == ts_onchain.get("txId"), "Transaction IDs don't match"


def compare_signature_responses(py_response: Dict[str, Any], ts_response: Dict[str, Any]) -> None:
    """Compare signature responses between implementations.
    
    Args:
        py_response: Response from Python implementation
        ts_response: Response from TypeScript implementation
        
    Raises:
        AssertionError: If responses don't match
    """
    assert py_response["signature"] == ts_response["signature"], "Signatures don't match"
    
    # Compare optional fields if present
    if "status" in py_response or "status" in ts_response:
        assert py_response.get("status") == ts_response.get("status"), "Signature status doesn't match"


def compare_approval_responses(py_response: Dict[str, Any], ts_response: Dict[str, Any]) -> None:
    """Compare approval responses between implementations.
    
    Args:
        py_response: Response from Python implementation
        ts_response: Response from TypeScript implementation
        
    Raises:
        AssertionError: If responses don't match
    """
    # Compare pending approvals if present
    if "approvals" in py_response or "approvals" in ts_response:
        py_approvals = py_response.get("approvals", {}).get("pending", [])
        ts_approvals = ts_response.get("approvals", {}).get("pending", [])
        assert len(py_approvals) == len(ts_approvals), "Number of pending approvals doesn't match"
        
        for py_approval, ts_approval in zip(py_approvals, ts_approvals):
            assert py_approval.get("message") == ts_approval.get("message"), "Approval messages don't match"
            assert py_approval.get("signer") == ts_approval.get("signer"), "Approval signers don't match"


def compare_error_responses(py_error: Exception, ts_error: Exception) -> None:
    """Compare error responses between implementations.
    
    Args:
        py_error: Error from Python implementation
        ts_error: Error from TypeScript implementation
        
    Raises:
        AssertionError: If error messages don't indicate similar failures
    """
    # Extract error messages
    py_msg = str(py_error).lower()
    ts_msg = str(ts_error).lower()
    
    # Check if both errors indicate the same type of failure
    if "not found" in py_msg:
        assert "not found" in ts_msg, "Error types don't match - Python indicates not found but TypeScript doesn't"
    elif "unauthorized" in py_msg:
        assert "unauthorized" in ts_msg, "Error types don't match - Python indicates unauthorized but TypeScript doesn't"
    elif "invalid" in py_msg:
        assert "invalid" in ts_msg, "Error types don't match - Python indicates invalid input but TypeScript doesn't"
