"""
Remote Agent Orchestrator

Main orchestration layer for managing remote Dexter agents in E2B sandboxes.
"""

import json
import logging
from typing import Dict, Optional, Any, List
from datetime import datetime

from .config import RemoteAgentConfig
from .e2b_manager import E2BSandboxManager
from .github_integration import GitHubIntegration

logger = logging.getLogger(__name__)


class RemoteAgentOrchestrator:
    """
    Main orchestrator for remote Dexter agents

    Manages the complete lifecycle of agents running in E2B sandboxes,
    including setup, execution, and monitoring.
    """

    def __init__(self, config: Optional[RemoteAgentConfig] = None):
        """
        Initialize the orchestrator

        Args:
            config: Remote agent configuration (uses env vars if not provided)
        """
        # Load configuration
        self.config = config or RemoteAgentConfig.from_env()
        self.config.validate()

        # Initialize managers
        self.e2b_manager = E2BSandboxManager(
            api_key=self.config.e2b.api_key,
            default_timeout=self.config.e2b.default_timeout,
            auto_pause=self.config.e2b.auto_pause
        )

        self.github = GitHubIntegration(
            token=self.config.github.token,
            repo_owner=self.config.github.repo_owner,
            repo_name=self.config.github.repo_name
        )

        # Track active agents
        self.agents: Dict[str, Dict[str, Any]] = {}

        logger.info("Remote Agent Orchestrator initialized")

    def launch_agent(
        self,
        agent_name: Optional[str] = None,
        persistent: bool = True,
        timeout: Optional[int] = None
    ) -> str:
        """
        Launch a new remote agent

        Args:
            agent_name: Optional name for the agent
            persistent: Enable pause/resume functionality
            timeout: Custom timeout in seconds

        Returns:
            Agent ID (sandbox ID)
        """
        agent_name = agent_name or f"agent_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        logger.info(f"Launching agent: {agent_name}")

        try:
            # Create E2B sandbox
            sandbox_id = self.e2b_manager.create_sandbox(
                timeout=timeout,
                metadata={
                    "agent_name": agent_name,
                    "agent_type": "dexter_financial_research",
                    "created_at": datetime.now().isoformat()
                },
                persistent=persistent
            )

            # Connect to sandbox
            sandbox = self.e2b_manager.connect_to_sandbox(sandbox_id)

            # Clone repository
            if not self.github.clone_repository(sandbox):
                raise Exception("Failed to clone repository")

            # Set up Dexter environment
            dexter_env = self.config.dexter.to_env_dict()
            if not self.e2b_manager.setup_dexter_environment(sandbox, dexter_env):
                raise Exception("Failed to setup Dexter environment")

            # Track agent
            self.agents[sandbox_id] = {
                "agent_id": sandbox_id,
                "agent_name": agent_name,
                "created_at": datetime.now().isoformat(),
                "status": "active",
                "persistent": persistent,
                "query_count": 0
            }

            logger.info(f"Agent launched successfully: {agent_name} (ID: {sandbox_id})")
            return sandbox_id

        except Exception as e:
            logger.error(f"Failed to launch agent: {e}")
            raise

    def query_agent(
        self,
        agent_id: str,
        query: str,
        timeout: int = 300
    ) -> Dict[str, Any]:
        """
        Send a research query to a remote agent

        Args:
            agent_id: Agent ID (sandbox ID)
            query: Research question
            timeout: Query timeout in seconds

        Returns:
            Query result with answer and metadata
        """
        logger.info(f"Querying agent {agent_id}: {query}")

        if agent_id not in self.agents:
            raise ValueError(f"Agent {agent_id} not found")

        try:
            # Connect to sandbox
            sandbox = self.e2b_manager.connect_to_sandbox(agent_id)

            # Prepare query script
            query_script = f"""
import sys
import os
sys.path.insert(0, '/home/user/dexter/src')

from dexter.agent import Agent

agent = Agent()
result = agent.run("{query.replace('"', '\\"')}")
print(result)
"""

            # Write query script
            sandbox.filesystem.write("/tmp/query.py", query_script)

            # Execute query
            command = "cd /home/user/dexter && uv run python /tmp/query.py"
            result = self.e2b_manager.execute_command(sandbox, command, timeout=timeout)

            # Update agent stats
            if agent_id in self.agents:
                self.agents[agent_id]["query_count"] += 1
                self.agents[agent_id]["last_query"] = datetime.now().isoformat()

            if result["success"]:
                logger.info(f"Query completed successfully")
                return {
                    "success": True,
                    "query": query,
                    "answer": result["stdout"].strip(),
                    "agent_id": agent_id,
                    "timestamp": datetime.now().isoformat()
                }
            else:
                logger.error(f"Query failed: {result['stderr']}")
                return {
                    "success": False,
                    "query": query,
                    "error": result["stderr"],
                    "agent_id": agent_id,
                    "timestamp": datetime.now().isoformat()
                }

        except Exception as e:
            logger.error(f"Failed to query agent: {e}")
            return {
                "success": False,
                "query": query,
                "error": str(e),
                "agent_id": agent_id,
                "timestamp": datetime.now().isoformat()
            }

    def pause_agent(self, agent_id: str) -> bool:
        """
        Pause an agent to preserve its state

        Args:
            agent_id: Agent ID

        Returns:
            Success status
        """
        logger.info(f"Pausing agent: {agent_id}")

        if agent_id not in self.agents:
            raise ValueError(f"Agent {agent_id} not found")

        try:
            success = self.e2b_manager.pause_sandbox(agent_id)

            if success and agent_id in self.agents:
                self.agents[agent_id]["status"] = "paused"
                self.agents[agent_id]["paused_at"] = datetime.now().isoformat()

            return success

        except Exception as e:
            logger.error(f"Failed to pause agent: {e}")
            return False

    def resume_agent(self, agent_id: str) -> bool:
        """
        Resume a paused agent

        Args:
            agent_id: Agent ID

        Returns:
            Success status
        """
        logger.info(f"Resuming agent: {agent_id}")

        if agent_id not in self.agents:
            raise ValueError(f"Agent {agent_id} not found")

        try:
            sandbox = self.e2b_manager.resume_sandbox(agent_id)

            if sandbox and agent_id in self.agents:
                self.agents[agent_id]["status"] = "active"
                self.agents[agent_id]["resumed_at"] = datetime.now().isoformat()

            return True

        except Exception as e:
            logger.error(f"Failed to resume agent: {e}")
            return False

    def terminate_agent(self, agent_id: str) -> bool:
        """
        Terminate an agent permanently

        Args:
            agent_id: Agent ID

        Returns:
            Success status
        """
        logger.info(f"Terminating agent: {agent_id}")

        if agent_id not in self.agents:
            raise ValueError(f"Agent {agent_id} not found")

        try:
            success = self.e2b_manager.terminate_sandbox(agent_id)

            if success and agent_id in self.agents:
                self.agents[agent_id]["status"] = "terminated"
                self.agents[agent_id]["terminated_at"] = datetime.now().isoformat()

            return success

        except Exception as e:
            logger.error(f"Failed to terminate agent: {e}")
            return False

    def update_agent_code(self, agent_id: str) -> bool:
        """
        Update agent code from repository

        Args:
            agent_id: Agent ID

        Returns:
            Success status
        """
        logger.info(f"Updating agent code: {agent_id}")

        if agent_id not in self.agents:
            raise ValueError(f"Agent {agent_id} not found")

        try:
            sandbox = self.e2b_manager.connect_to_sandbox(agent_id)

            # Pull latest changes
            if not self.github.pull_latest_changes(sandbox):
                raise Exception("Failed to pull latest changes")

            # Re-sync dependencies
            result = self.e2b_manager.execute_command(
                sandbox,
                "cd /home/user/dexter && uv sync",
                timeout=300
            )

            if not result["success"]:
                raise Exception(f"Failed to sync dependencies: {result['stderr']}")

            logger.info("Agent code updated successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to update agent code: {e}")
            return False

    def get_agent_info(self, agent_id: str) -> Optional[Dict[str, Any]]:
        """
        Get information about an agent

        Args:
            agent_id: Agent ID

        Returns:
            Agent information
        """
        return self.agents.get(agent_id)

    def list_agents(self) -> List[Dict[str, Any]]:
        """
        List all tracked agents

        Returns:
            List of agent information
        """
        return list(self.agents.values())

    def health_check(self, agent_id: str) -> bool:
        """
        Check if an agent is responsive

        Args:
            agent_id: Agent ID

        Returns:
            Health status
        """
        logger.info(f"Health check for agent: {agent_id}")

        try:
            sandbox = self.e2b_manager.connect_to_sandbox(agent_id)

            # Simple command to check responsiveness
            result = self.e2b_manager.execute_command(
                sandbox,
                "echo 'healthy'",
                timeout=10
            )

            return result["success"] and "healthy" in result["stdout"]

        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False

    def create_agent_pool(self, size: int, persistent: bool = True) -> List[str]:
        """
        Create a pool of agents for parallel processing

        Args:
            size: Number of agents to create
            persistent: Enable persistence for agents

        Returns:
            List of agent IDs
        """
        logger.info(f"Creating agent pool of size {size}")

        agent_ids = []
        for i in range(size):
            try:
                agent_id = self.launch_agent(
                    agent_name=f"pool_agent_{i}",
                    persistent=persistent
                )
                agent_ids.append(agent_id)
            except Exception as e:
                logger.error(f"Failed to create pool agent {i}: {e}")

        logger.info(f"Created {len(agent_ids)} agents in pool")
        return agent_ids

    def save_state(self, filepath: str = "orchestrator_state.json") -> bool:
        """
        Save orchestrator state to file

        Args:
            filepath: Path to save state

        Returns:
            Success status
        """
        try:
            state = {
                "agents": self.agents,
                "timestamp": datetime.now().isoformat()
            }

            with open(filepath, 'w') as f:
                json.dump(state, f, indent=2)

            # Also save E2B manager state
            self.e2b_manager.save_state("e2b_state.json")

            logger.info(f"State saved to {filepath}")
            return True

        except Exception as e:
            logger.error(f"Failed to save state: {e}")
            return False

    def load_state(self, filepath: str = "orchestrator_state.json") -> bool:
        """
        Load orchestrator state from file

        Args:
            filepath: Path to state file

        Returns:
            Success status
        """
        try:
            with open(filepath, 'r') as f:
                state = json.load(f)

            self.agents = state.get("agents", {})

            # Also load E2B manager state
            self.e2b_manager.load_state("e2b_state.json")

            logger.info(f"State loaded from {filepath}")
            return True

        except Exception as e:
            logger.error(f"Failed to load state: {e}")
            return False
