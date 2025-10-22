"""
Configuration management for remote agent orchestration
"""

import os
from dataclasses import dataclass
from typing import Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


@dataclass
class E2BConfig:
    """E2B sandbox configuration"""
    api_key: str
    default_timeout: int = 3600  # 1 hour default
    auto_pause: bool = True
    max_timeout: int = 86400  # 24 hours (Pro tier)

    @classmethod
    def from_env(cls):
        """Create config from environment variables"""
        return cls(
            api_key=os.getenv("E2B_API_KEY", ""),
            default_timeout=int(os.getenv("E2B_DEFAULT_TIMEOUT", "3600")),
            auto_pause=os.getenv("E2B_AUTO_PAUSE", "true").lower() == "true",
            max_timeout=int(os.getenv("E2B_MAX_TIMEOUT", "86400"))
        )


@dataclass
class GitHubConfig:
    """GitHub API configuration"""
    token: str
    repo_owner: str
    repo_name: str

    @classmethod
    def from_env(cls):
        """Create config from environment variables"""
        return cls(
            token=os.getenv("GITHUB_TOKEN", ""),
            repo_owner=os.getenv("GITHUB_REPO_OWNER", ""),
            repo_name=os.getenv("GITHUB_REPO_NAME", "dexter")
        )

    @property
    def repo_url(self) -> str:
        """Get repository URL"""
        return f"https://github.com/{self.repo_owner}/{self.repo_name}"

    @property
    def authenticated_url(self) -> str:
        """Get repository URL with authentication"""
        return f"https://{self.token}@github.com/{self.repo_owner}/{self.repo_name}.git"


@dataclass
class DexterConfig:
    """Dexter agent configuration"""
    openai_api_key: str
    financial_datasets_api_key: str
    max_steps: int = 20
    max_steps_per_task: int = 5

    @classmethod
    def from_env(cls):
        """Create config from environment variables"""
        return cls(
            openai_api_key=os.getenv("OPENAI_API_KEY", ""),
            financial_datasets_api_key=os.getenv("FINANCIAL_DATASETS_API_KEY", ""),
            max_steps=int(os.getenv("DEXTER_MAX_STEPS", "20")),
            max_steps_per_task=int(os.getenv("DEXTER_MAX_STEPS_PER_TASK", "5"))
        )

    def to_env_dict(self) -> dict:
        """Convert to environment variable dictionary"""
        return {
            "OPENAI_API_KEY": self.openai_api_key,
            "FINANCIAL_DATASETS_API_KEY": self.financial_datasets_api_key,
            "DEXTER_MAX_STEPS": str(self.max_steps),
            "DEXTER_MAX_STEPS_PER_TASK": str(self.max_steps_per_task)
        }


@dataclass
class ClaudeCodeConfig:
    """Claude Code CLI configuration"""
    anthropic_api_key: Optional[str] = None
    enabled: bool = False

    @classmethod
    def from_env(cls):
        """Create config from environment variables"""
        api_key = os.getenv("ANTHROPIC_API_KEY")
        return cls(
            anthropic_api_key=api_key,
            enabled=api_key is not None and os.getenv("ENABLE_CLAUDE_CODE", "false").lower() == "true"
        )


@dataclass
class RemoteAgentConfig:
    """Complete remote agent configuration"""
    e2b: E2BConfig
    github: GitHubConfig
    dexter: DexterConfig
    claude_code: ClaudeCodeConfig

    @classmethod
    def from_env(cls):
        """Create complete config from environment variables"""
        return cls(
            e2b=E2BConfig.from_env(),
            github=GitHubConfig.from_env(),
            dexter=DexterConfig.from_env(),
            claude_code=ClaudeCodeConfig.from_env()
        )

    def validate(self) -> bool:
        """Validate that all required configuration is present"""
        errors = []

        if not self.e2b.api_key:
            errors.append("E2B_API_KEY is required")

        if not self.github.token:
            errors.append("GITHUB_TOKEN is required")

        if not self.github.repo_owner:
            errors.append("GITHUB_REPO_OWNER is required")

        if not self.dexter.openai_api_key:
            errors.append("OPENAI_API_KEY is required")

        if not self.dexter.financial_datasets_api_key:
            errors.append("FINANCIAL_DATASETS_API_KEY is required")

        if errors:
            raise ValueError(f"Configuration validation failed:\n" + "\n".join(f"  - {e}" for e in errors))

        return True
