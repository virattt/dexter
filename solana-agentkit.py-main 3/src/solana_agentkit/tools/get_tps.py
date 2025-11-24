# src/solana_agentkit/tools/get_tps.py

from typing import Optional, Dict, Any
from dataclasses import dataclass

from solana_agentkit.agent.solana_agent import SolanaAgent

@dataclass
class PerformanceInfo:
    """Information about Solana network performance."""
    tps: float
    num_transactions: int
    sample_period_secs: int
    slot: int

async def get_tps(agent: 'SolanaAgent') -> float:
    """
    Get the current transactions per second (TPS) for the Solana network.
    
    Args:
        agent: SolanaAgentKit instance
        
    Returns:
        Current TPS as a float
        
    Raises:
        Exception: If performance samples are not available
    """
    try:
        # Get recent performance samples
        perf_samples = await agent.connection.get_recent_performance_samples(1)
        
        # Validate we got samples
        if not perf_samples:
            raise Exception("No performance samples available")
            
        sample = perf_samples[0]
        
        # Validate sample data
        if (not hasattr(sample, 'num_transactions') or 
            not hasattr(sample, 'sample_period_secs') or
            not sample.num_transactions or 
            not sample.sample_period_secs):
            raise Exception("Invalid performance sample data")
            
        # Calculate TPS
        tps = sample.num_transactions / sample.sample_period_secs
        
        return tps
        
    except Exception as error:
        raise Exception(f"Failed to get TPS: {str(error)}") from error

async def get_detailed_performance(
    agent: 'SolanaAgent',
    num_samples: int = 1
) -> list[PerformanceInfo]:
    """
    Get detailed performance information from multiple samples.
    
    Args:
        agent: SolanaAgentKit instance
        num_samples: Number of samples to retrieve (default: 1)
        
    Returns:
        List of PerformanceInfo objects
    """
    try:
        samples = await agent.connection.get_recent_performance_samples(num_samples)
        
        if not samples:
            raise Exception("No performance samples available")
            
        return [
            PerformanceInfo(
                tps=sample.num_transactions / sample.sample_period_secs,
                num_transactions=sample.num_transactions,
                sample_period_secs=sample.sample_period_secs,
                slot=sample.slot
            )
            for sample in samples
        ]
        
    except Exception as error:
        raise Exception(f"Failed to get performance info: {str(error)}") from error

class NetworkPerformanceMonitor:
    """Helper class for monitoring network performance over time."""
    
    def __init__(self, agent: 'SolanaAgent'):
        self.agent = agent
        self.samples: list[PerformanceInfo] = []
        
    async def update(self) -> PerformanceInfo:
        """Get latest performance sample and add to history."""
        latest = await get_detailed_performance(self.agent)
        self.samples.append(latest[0])
        return latest[0]
        
    def get_average_tps(self) -> Optional[float]:
        """Calculate average TPS from collected samples."""
        if not self.samples:
            return None
        return sum(sample.tps for sample in self.samples) / len(self.samples)
        
    def get_max_tps(self) -> Optional[float]:
        """Get maximum TPS from collected samples."""
        if not self.samples:
            return None
        return max(sample.tps for sample in self.samples)
        
    def clear_history(self) -> None:
        """Clear collected performance history."""
        self.samples.clear()