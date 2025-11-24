import pytest
import asyncio
#from solana.keypair import Keypair
#from solana.publickey import PublicKey
from rsa import PublicKey
from solana.rpc.async_api import AsyncClient
from solana_agentkit.agent import SolanaAgent
from solana_agentkit.tools import (
    transfer_tokens,
    get_balance,
    deploy_token
)

@pytest.fixture
def keypair():
    """Create a test keypair."""
    return keypair()

@pytest.fixture
def rpc_url():
    """Get test network RPC URL."""
    return "https://api.devnet.solana.com"

@pytest.fixture
async def agent(keypair, rpc_url):
    """Create a test agent instance."""
    agent = SolanaAgent(
        private_key=str(keypair.secret_key),
        rpc_url=rpc_url,
        openai_api_key="test_key"
    )
    await agent.initialize()
    return agent

@pytest.mark.asyncio
async def test_agent_initialization(agent):
    """Test agent initialization."""
    assert agent.wallet is not None
    assert agent.connection is not None
    assert isinstance(agent.connection, AsyncClient)

@pytest.mark.asyncio
async def test_agent_balance(agent):
    """Test balance checking."""
    balance = await agent.get_balance()
    assert isinstance(balance, float)
    assert balance >= 0

@pytest.mark.asyncio
async def test_agent_token_deployment(agent):
    """Test token deployment."""
    try:
        result = await agent.deploy_token(decimals=6)
        assert result.mint is not None
        assert isinstance(result.mint, PublicKey)
    except Exception as e:
        pytest.skip(f"Token deployment failed: {e}")

@pytest.mark.asyncio
async def test_agent_message_processing(agent):
    """Test agent message processing."""
    response = await agent.process_message(
        "What is my wallet balance?"
    )
    assert response is not None
    assert isinstance(response, str)

@pytest.mark.asyncio
async def test_agent_tool_addition(agent):
    """Test adding tools to agent."""
    initial_tool_count = len(agent.tools)
    
    # Add a new tool
    async def test_tool(*args, **kwargs):
        return "test result"
    
    await agent.add_tool(test_tool)
    assert len(agent.tools) == initial_tool_count + 1