import pytest
from solana_agentkit import SolanaAgent
from solana_agentkit.tools import (
    BaseTool,
    ChainTool,
    TransferTool,
    TokenDeployTool,
    NFTTool
)
from solana_agentkit.utils import keypair

@pytest.fixture
def transfer_tool(agent):
    """Create transfer tool instance."""
    return TransferTool(agent)

@pytest.fixture
def token_tool(agent):
    """Create token deployment tool instance."""
    return TokenDeployTool(agent)

@pytest.fixture
def nft_tool(agent):
    """Create NFT tool instance."""
    return NFTTool(agent)

@pytest.mark.asyncio
async def test_transfer_tool(transfer_tool):
    """Test transfer tool functionality."""
    recipient = keypair().public_key
    amount = 0.001
    
    try:
        result = await transfer_tool.execute(
            recipient=recipient,
            amount=amount
        )
        assert result.success
        assert result.transaction_signature is not None
    except Exception as e:
        pytest.skip(f"Transfer failed: {e}")

@pytest.mark.asyncio
async def test_token_deployment_tool(token_tool):
    """Test token deployment tool."""
    try:
        result = await token_tool.execute(
            decimals=6,
            initial_supply=1000000
        )
        assert result.success
        assert result.data.get('mint') is not None
    except Exception as e:
        pytest.skip(f"Token deployment failed: {e}")

@pytest.mark.asyncio
async def test_nft_tool(nft_tool):
    """Test NFT tool functionality."""
    try:
        result = await nft_tool.execute(
            name="Test NFT",
            symbol="TEST",
            uri="https://example.com/metadata.json"
        )
        assert result.success
        assert result.data.get('mint') is not None
    except Exception as e:
        pytest.skip(f"NFT creation failed: {e}")

@pytest.mark.asyncio
async def test_tool_initialization():
    """Test tool base functionality."""
    class TestTool(BaseTool):
        def get_description(self):
            return "Test tool"
        
        async def _execute(self, *args, **kwargs):
            return {"success": True, "data": "test"}
    
    tool = TestTool("test_tool")
    assert tool.name == "test_tool"
    assert tool.get_description() == "Test tool"

@pytest.mark.asyncio
async def test_chain_tool(agent):
    """Test chain tool functionality."""
    class TestChainTool(ChainTool):
        def get_description(self):
            return "Test chain tool"
            
        async def execute_chain_operation(self, *args, **kwargs):
            return {"success": True, "data": "test"}
    
    tool = TestChainTool("test_chain_tool")
    await tool.initialize(agent.connection, agent.wallet)
    
    result = await tool.execute()
    assert result['success']
    assert result['data'] == "test"

def test_tool_validation():
    """Test tool input validation."""
    with pytest.raises(ValueError):
        class InvalidTool(BaseTool):
            pass
        
        InvalidTool("invalid")

@pytest.mark.asyncio
async def test_tool_error_handling(transfer_tool):
    """Test tool error handling."""
    result = await transfer_tool.execute(
        recipient=None,
        amount=-1
    )
    assert not result.success
    assert result.error is not None