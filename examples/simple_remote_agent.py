"""
Simple Remote Agent Example

This example shows how to:
1. Launch a remote Dexter agent in E2B
2. Send queries to the agent
3. Retrieve results
"""

import logging
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from remote_agent.orchestrator import RemoteAgentOrchestrator

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def main():
    """Run simple remote agent example"""

    print("=" * 60)
    print("Simple Remote Agent Example")
    print("=" * 60)

    # Initialize orchestrator
    print("\n1. Initializing orchestrator...")
    orchestrator = RemoteAgentOrchestrator()

    # Launch a remote agent
    print("\n2. Launching remote agent...")
    agent_id = orchestrator.launch_agent(
        agent_name="example_agent",
        persistent=True
    )
    print(f"   Agent launched: {agent_id}")

    # Send a query
    print("\n3. Sending query to agent...")
    query = "What was Apple's revenue growth over the last 4 quarters?"
    print(f"   Query: {query}")

    result = orchestrator.query_agent(agent_id, query)

    print("\n4. Query Result:")
    print("-" * 60)
    if result["success"]:
        print(f"Answer: {result['answer']}")
    else:
        print(f"Error: {result.get('error', 'Unknown error')}")
    print("-" * 60)

    # Check agent health
    print("\n5. Checking agent health...")
    is_healthy = orchestrator.health_check(agent_id)
    print(f"   Agent healthy: {is_healthy}")

    # Get agent info
    print("\n6. Agent Information:")
    info = orchestrator.get_agent_info(agent_id)
    print(f"   Name: {info['agent_name']}")
    print(f"   Status: {info['status']}")
    print(f"   Query Count: {info['query_count']}")

    # Cleanup options
    print("\n7. Cleanup Options:")
    print("   a) Pause agent (preserves state)")
    print("   b) Terminate agent (permanent)")
    print("   c) Keep agent running")

    choice = input("\n   Your choice (a/b/c): ").lower()

    if choice == 'a':
        print("\n   Pausing agent...")
        orchestrator.pause_agent(agent_id)
        print("   Agent paused. You can resume later with orchestrator.resume_agent(agent_id)")
    elif choice == 'b':
        print("\n   Terminating agent...")
        orchestrator.terminate_agent(agent_id)
        print("   Agent terminated.")
    else:
        print("\n   Keeping agent running.")
        print(f"   Agent ID: {agent_id}")
        print("   Use this ID to reconnect later.")

    print("\n" + "=" * 60)
    print("Example completed!")
    print("=" * 60)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nExample interrupted by user.")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Example failed: {e}", exc_info=True)
        sys.exit(1)
