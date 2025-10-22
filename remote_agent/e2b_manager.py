"""
E2B Sandbox Manager for Remote Agents

Handles creation, lifecycle management, and persistence of E2B sandboxes.
"""

import json
import logging
from typing import Dict, Optional, Any
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class SandboxInfo:
    """Information about a sandbox instance"""
    sandbox_id: str
    created_at: datetime
    status: str  # active, paused, terminated
    metadata: Dict[str, Any]
    timeout: int
    auto_pause: bool


class E2BSandboxManager:
    """Manages E2B sandboxes for remote agents"""

    def __init__(self, api_key: str, default_timeout: int = 3600, auto_pause: bool = True):
        """
        Initialize E2B manager

        Args:
            api_key: E2B API key
            default_timeout: Default sandbox timeout in seconds
            auto_pause: Enable auto-pause for sandboxes
        """
        self.api_key = api_key
        self.default_timeout = default_timeout
        self.auto_pause = auto_pause
        self.sandboxes: Dict[str, SandboxInfo] = {}

        # Note: Import here to handle if e2b is not installed
        try:
            from e2b_code_interpreter import Sandbox
            self.Sandbox = Sandbox
        except ImportError:
            raise ImportError(
                "e2b_code_interpreter is not installed. "
                "Install it with: pip install e2b-code-interpreter"
            )

    def create_sandbox(
        self,
        timeout: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
        persistent: bool = True
    ) -> str:
        """
        Create a new E2B sandbox

        Args:
            timeout: Sandbox timeout in seconds (default: use configured default)
            metadata: Additional metadata for the sandbox
            persistent: Enable pause/resume functionality

        Returns:
            Sandbox ID
        """
        timeout = timeout or self.default_timeout
        metadata = metadata or {}

        logger.info(f"Creating E2B sandbox (timeout={timeout}s, persistent={persistent})")

        try:
            if persistent and self.auto_pause:
                # Use beta API for persistent sandboxes
                sandbox = self.Sandbox.beta_create(
                    timeout=timeout,
                    auto_pause=True,
                    metadata=metadata
                )
                logger.info(f"Created persistent sandbox with auto-pause: {sandbox.id}")
            else:
                # Standard sandbox
                sandbox = self.Sandbox.create(
                    timeout=timeout,
                    metadata=metadata
                )
                logger.info(f"Created standard sandbox: {sandbox.id}")

            # Track sandbox info
            info = SandboxInfo(
                sandbox_id=sandbox.id,
                created_at=datetime.now(),
                status="active",
                metadata=metadata,
                timeout=timeout,
                auto_pause=persistent and self.auto_pause
            )
            self.sandboxes[sandbox.id] = info

            return sandbox.id

        except Exception as e:
            logger.error(f"Failed to create sandbox: {e}")
            raise

    def connect_to_sandbox(self, sandbox_id: str):
        """
        Connect to an existing sandbox

        Args:
            sandbox_id: ID of sandbox to connect to

        Returns:
            Sandbox instance
        """
        logger.info(f"Connecting to sandbox: {sandbox_id}")

        try:
            sandbox = self.Sandbox.connect(sandbox_id)

            # Update tracking
            if sandbox_id in self.sandboxes:
                self.sandboxes[sandbox_id].status = "active"
            else:
                # Add to tracking if not already present
                self.sandboxes[sandbox_id] = SandboxInfo(
                    sandbox_id=sandbox_id,
                    created_at=datetime.now(),
                    status="active",
                    metadata={},
                    timeout=self.default_timeout,
                    auto_pause=False
                )

            return sandbox

        except Exception as e:
            logger.error(f"Failed to connect to sandbox {sandbox_id}: {e}")
            raise

    def pause_sandbox(self, sandbox_id: str) -> bool:
        """
        Pause a sandbox to preserve its state

        Args:
            sandbox_id: ID of sandbox to pause

        Returns:
            Success status
        """
        logger.info(f"Pausing sandbox: {sandbox_id}")

        try:
            sandbox = self.connect_to_sandbox(sandbox_id)
            sandbox.beta_pause()

            # Update status
            if sandbox_id in self.sandboxes:
                self.sandboxes[sandbox_id].status = "paused"

            logger.info(f"Successfully paused sandbox: {sandbox_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to pause sandbox {sandbox_id}: {e}")
            return False

    def resume_sandbox(self, sandbox_id: str):
        """
        Resume a paused sandbox

        Args:
            sandbox_id: ID of sandbox to resume

        Returns:
            Sandbox instance
        """
        logger.info(f"Resuming sandbox: {sandbox_id}")

        try:
            sandbox = self.connect_to_sandbox(sandbox_id)

            # Update status
            if sandbox_id in self.sandboxes:
                self.sandboxes[sandbox_id].status = "active"

            logger.info(f"Successfully resumed sandbox: {sandbox_id}")
            return sandbox

        except Exception as e:
            logger.error(f"Failed to resume sandbox {sandbox_id}: {e}")
            raise

    def terminate_sandbox(self, sandbox_id: str) -> bool:
        """
        Terminate a sandbox permanently

        Args:
            sandbox_id: ID of sandbox to terminate

        Returns:
            Success status
        """
        logger.info(f"Terminating sandbox: {sandbox_id}")

        try:
            sandbox = self.connect_to_sandbox(sandbox_id)
            sandbox.kill()

            # Update status
            if sandbox_id in self.sandboxes:
                self.sandboxes[sandbox_id].status = "terminated"

            logger.info(f"Successfully terminated sandbox: {sandbox_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to terminate sandbox {sandbox_id}: {e}")
            return False

    def setup_dexter_environment(self, sandbox, dexter_env: Dict[str, str]) -> bool:
        """
        Set up the Dexter environment in a sandbox

        Args:
            sandbox: E2B Sandbox instance
            dexter_env: Environment variables for Dexter

        Returns:
            Success status
        """
        logger.info("Setting up Dexter environment in sandbox")

        try:
            # Create .env file with configuration
            env_content = "\n".join([f"{k}={v}" for k, v in dexter_env.items()])
            sandbox.filesystem.write("/home/user/dexter/.env", env_content)

            # Install dependencies using uv
            logger.info("Installing dependencies with uv...")
            result = sandbox.process.start_and_wait(
                "cd /home/user/dexter && uv sync",
                timeout=300  # 5 minutes for installation
            )

            if result.exit_code != 0:
                logger.error(f"Failed to install dependencies: {result.stderr}")
                return False

            logger.info("Successfully set up Dexter environment")
            return True

        except Exception as e:
            logger.error(f"Failed to setup Dexter environment: {e}")
            return False

    def execute_command(self, sandbox, command: str, timeout: int = 30) -> Dict[str, Any]:
        """
        Execute a command in the sandbox

        Args:
            sandbox: E2B Sandbox instance
            command: Command to execute
            timeout: Command timeout in seconds

        Returns:
            Command result with stdout, stderr, exit_code
        """
        logger.info(f"Executing command: {command}")

        try:
            result = sandbox.process.start_and_wait(command, timeout=timeout)

            return {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.exit_code,
                "success": result.exit_code == 0
            }

        except Exception as e:
            logger.error(f"Command execution failed: {e}")
            return {
                "stdout": "",
                "stderr": str(e),
                "exit_code": -1,
                "success": False
            }

    def get_sandbox_info(self, sandbox_id: str) -> Optional[SandboxInfo]:
        """Get information about a sandbox"""
        return self.sandboxes.get(sandbox_id)

    def list_sandboxes(self) -> Dict[str, SandboxInfo]:
        """List all tracked sandboxes"""
        return self.sandboxes.copy()

    def save_state(self, filepath: str) -> bool:
        """
        Save sandbox state to a file

        Args:
            filepath: Path to save state file

        Returns:
            Success status
        """
        try:
            state = {
                sandbox_id: {
                    "sandbox_id": info.sandbox_id,
                    "created_at": info.created_at.isoformat(),
                    "status": info.status,
                    "metadata": info.metadata,
                    "timeout": info.timeout,
                    "auto_pause": info.auto_pause
                }
                for sandbox_id, info in self.sandboxes.items()
            }

            with open(filepath, 'w') as f:
                json.dump(state, f, indent=2)

            logger.info(f"Saved sandbox state to {filepath}")
            return True

        except Exception as e:
            logger.error(f"Failed to save state: {e}")
            return False

    def load_state(self, filepath: str) -> bool:
        """
        Load sandbox state from a file

        Args:
            filepath: Path to state file

        Returns:
            Success status
        """
        try:
            with open(filepath, 'r') as f:
                state = json.load(f)

            for sandbox_id, data in state.items():
                self.sandboxes[sandbox_id] = SandboxInfo(
                    sandbox_id=data["sandbox_id"],
                    created_at=datetime.fromisoformat(data["created_at"]),
                    status=data["status"],
                    metadata=data["metadata"],
                    timeout=data["timeout"],
                    auto_pause=data["auto_pause"]
                )

            logger.info(f"Loaded sandbox state from {filepath}")
            return True

        except Exception as e:
            logger.error(f"Failed to load state: {e}")
            return False
