"""
GitHub Integration for Remote Agents

Handles repository operations, webhooks, and GitHub API interactions.
"""

import logging
import requests
from typing import Dict, Optional, List, Any

logger = logging.getLogger(__name__)


class GitHubIntegration:
    """Manages GitHub operations for remote agents"""

    def __init__(self, token: str, repo_owner: str, repo_name: str):
        """
        Initialize GitHub integration

        Args:
            token: GitHub personal access token
            repo_owner: Repository owner username
            repo_name: Repository name
        """
        self.token = token
        self.repo_owner = repo_owner
        self.repo_name = repo_name
        self.base_url = "https://api.github.com"

        self.headers = {
            "Authorization": f"token {self.token}",
            "Accept": "application/vnd.github.v3+json"
        }

    @property
    def repo_url(self) -> str:
        """Get repository URL"""
        return f"https://github.com/{self.repo_owner}/{self.repo_name}"

    @property
    def authenticated_url(self) -> str:
        """Get repository URL with authentication for cloning"""
        return f"https://{self.token}@github.com/{self.repo_owner}/{self.repo_name}.git"

    def clone_repository(self, sandbox, target_dir: str = "/home/user/dexter") -> bool:
        """
        Clone repository into E2B sandbox

        Args:
            sandbox: E2B Sandbox instance
            target_dir: Target directory for clone

        Returns:
            Success status
        """
        logger.info(f"Cloning repository {self.repo_url} to {target_dir}")

        try:
            # Clone using authenticated URL
            command = f"git clone {self.authenticated_url} {target_dir}"
            result = sandbox.process.start_and_wait(command, timeout=120)

            if result.exit_code != 0:
                logger.error(f"Git clone failed: {result.stderr}")
                return False

            logger.info("Repository cloned successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to clone repository: {e}")
            return False

    def pull_latest_changes(self, sandbox, repo_dir: str = "/home/user/dexter") -> bool:
        """
        Pull latest changes from repository

        Args:
            sandbox: E2B Sandbox instance
            repo_dir: Repository directory

        Returns:
            Success status
        """
        logger.info("Pulling latest changes")

        try:
            command = f"cd {repo_dir} && git pull origin main"
            result = sandbox.process.start_and_wait(command, timeout=60)

            if result.exit_code != 0:
                logger.error(f"Git pull failed: {result.stderr}")
                return False

            logger.info("Successfully pulled latest changes")
            return True

        except Exception as e:
            logger.error(f"Failed to pull changes: {e}")
            return False

    def create_webhook(self, webhook_url: str, events: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Create a webhook for repository events

        Args:
            webhook_url: URL to send webhook events to
            events: List of events to subscribe to (default: push, pull_request)

        Returns:
            Webhook creation response
        """
        events = events or ["push", "pull_request"]

        logger.info(f"Creating webhook for events: {events}")

        url = f"{self.base_url}/repos/{self.repo_owner}/{self.repo_name}/hooks"

        payload = {
            "config": {
                "url": webhook_url,
                "content_type": "json",
                "insecure_ssl": "0"
            },
            "events": events,
            "active": True
        }

        try:
            response = requests.post(url, json=payload, headers=self.headers)
            response.raise_for_status()

            logger.info(f"Webhook created successfully: {response.json().get('id')}")
            return response.json()

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to create webhook: {e}")
            raise

    def delete_webhook(self, hook_id: int) -> bool:
        """
        Delete a webhook

        Args:
            hook_id: Webhook ID to delete

        Returns:
            Success status
        """
        logger.info(f"Deleting webhook: {hook_id}")

        url = f"{self.base_url}/repos/{self.repo_owner}/{self.repo_name}/hooks/{hook_id}"

        try:
            response = requests.delete(url, headers=self.headers)
            response.raise_for_status()

            logger.info(f"Webhook deleted successfully")
            return True

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to delete webhook: {e}")
            return False

    def list_webhooks(self) -> List[Dict[str, Any]]:
        """
        List all webhooks for the repository

        Returns:
            List of webhook configurations
        """
        url = f"{self.base_url}/repos/{self.repo_owner}/{self.repo_name}/hooks"

        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()

            return response.json()

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to list webhooks: {e}")
            return []

    def create_pull_request(
        self,
        title: str,
        body: str,
        head_branch: str,
        base_branch: str = "main"
    ) -> Dict[str, Any]:
        """
        Create a pull request

        Args:
            title: PR title
            body: PR description
            head_branch: Source branch
            base_branch: Target branch (default: main)

        Returns:
            Pull request data
        """
        logger.info(f"Creating pull request: {title}")

        url = f"{self.base_url}/repos/{self.repo_owner}/{self.repo_name}/pulls"

        payload = {
            "title": title,
            "body": body,
            "head": head_branch,
            "base": base_branch
        }

        try:
            response = requests.post(url, json=payload, headers=self.headers)
            response.raise_for_status()

            pr_data = response.json()
            logger.info(f"Pull request created: {pr_data.get('html_url')}")
            return pr_data

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to create pull request: {e}")
            raise

    def create_issue(self, title: str, body: str, labels: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Create an issue

        Args:
            title: Issue title
            body: Issue description
            labels: List of labels to add

        Returns:
            Issue data
        """
        logger.info(f"Creating issue: {title}")

        url = f"{self.base_url}/repos/{self.repo_owner}/{self.repo_name}/issues"

        payload = {
            "title": title,
            "body": body,
        }

        if labels:
            payload["labels"] = labels

        try:
            response = requests.post(url, json=payload, headers=self.headers)
            response.raise_for_status()

            issue_data = response.json()
            logger.info(f"Issue created: {issue_data.get('html_url')}")
            return issue_data

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to create issue: {e}")
            raise

    def comment_on_issue(self, issue_number: int, comment: str) -> Dict[str, Any]:
        """
        Add a comment to an issue or pull request

        Args:
            issue_number: Issue/PR number
            comment: Comment text

        Returns:
            Comment data
        """
        logger.info(f"Commenting on issue #{issue_number}")

        url = f"{self.base_url}/repos/{self.repo_owner}/{self.repo_name}/issues/{issue_number}/comments"

        payload = {"body": comment}

        try:
            response = requests.post(url, json=payload, headers=self.headers)
            response.raise_for_status()

            return response.json()

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to comment on issue: {e}")
            raise

    def get_repository_info(self) -> Dict[str, Any]:
        """
        Get repository information

        Returns:
            Repository data
        """
        url = f"{self.base_url}/repos/{self.repo_owner}/{self.repo_name}"

        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()

            return response.json()

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get repository info: {e}")
            raise

    def get_latest_commit(self, branch: str = "main") -> Dict[str, Any]:
        """
        Get the latest commit on a branch

        Args:
            branch: Branch name

        Returns:
            Commit data
        """
        url = f"{self.base_url}/repos/{self.repo_owner}/{self.repo_name}/commits/{branch}"

        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()

            return response.json()

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get latest commit: {e}")
            raise

    def create_branch(self, sandbox, new_branch: str, base_branch: str = "main",
                     repo_dir: str = "/home/user/dexter") -> bool:
        """
        Create a new branch in the sandbox

        Args:
            sandbox: E2B Sandbox instance
            new_branch: New branch name
            base_branch: Base branch to branch from
            repo_dir: Repository directory

        Returns:
            Success status
        """
        logger.info(f"Creating branch {new_branch} from {base_branch}")

        try:
            # Checkout base branch and create new branch
            commands = [
                f"cd {repo_dir}",
                f"git checkout {base_branch}",
                f"git pull origin {base_branch}",
                f"git checkout -b {new_branch}"
            ]

            command = " && ".join(commands)
            result = sandbox.process.start_and_wait(command, timeout=60)

            if result.exit_code != 0:
                logger.error(f"Failed to create branch: {result.stderr}")
                return False

            logger.info(f"Branch {new_branch} created successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to create branch: {e}")
            return False

    def commit_and_push(
        self,
        sandbox,
        message: str,
        branch: str,
        repo_dir: str = "/home/user/dexter"
    ) -> bool:
        """
        Commit changes and push to remote

        Args:
            sandbox: E2B Sandbox instance
            message: Commit message
            branch: Branch to push to
            repo_dir: Repository directory

        Returns:
            Success status
        """
        logger.info(f"Committing and pushing to {branch}")

        try:
            commands = [
                f"cd {repo_dir}",
                "git config user.name 'Dexter Agent'",
                "git config user.email 'dexter@example.com'",
                "git add .",
                f"git commit -m '{message}'",
                f"git push origin {branch}"
            ]

            command = " && ".join(commands)
            result = sandbox.process.start_and_wait(command, timeout=120)

            if result.exit_code != 0:
                logger.error(f"Failed to commit and push: {result.stderr}")
                return False

            logger.info("Successfully committed and pushed changes")
            return True

        except Exception as e:
            logger.error(f"Failed to commit and push: {e}")
            return False
