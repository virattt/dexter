"""
Remote Agent Orchestration for Dexter

This package provides tools to run Dexter as a persistent remote agent in E2B sandboxes.
"""

__version__ = "1.0.0"

from .orchestrator import RemoteAgentOrchestrator
from .e2b_manager import E2BSandboxManager
from .github_integration import GitHubIntegration

__all__ = [
    "RemoteAgentOrchestrator",
    "E2BSandboxManager",
    "GitHubIntegration"
]
