"""
Persistent Agent Example

This example demonstrates:
1. Creating a persistent agent
2. Using pause/resume functionality
3. Maintaining agent state across sessions
"""

import logging
import sys
import os
import time

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
    """Run persistent agent example"""

    print("=" * 60)
    print("Persistent Agent Example")
    print("=" * 60)

    # Initialize orchestrator
    print("\n1. Initializing orchestrator...")
    orchestrator = RemoteAgentOrchestrator()

    # Launch a persistent agent
    print("\n2. Launching persistent agent...")
    agent_id = orchestrator.launch_agent(
        agent_name="persistent_research_agent",
        persistent=True,
        timeout=3600  # 1 hour
    )
    print(f"   Agent ID: {agent_id}")

    # First query
    print("\n3. Sending first query...")
    query1 = "What is Tesla's current stock price?"
    result1 = orchestrator.query_agent(agent_id, query1)

    if result1["success"]:
        print(f"   Answer: {result1['answer'][:100]}...")
    else:
        print(f"   Error: {result1.get('error')}")

    # Pause the agent
    print("\n4. Pausing agent to preserve state...")
    orchestrator.pause_agent(agent_id)
    print("   Agent paused.")

    # Save orchestrator state
    print("\n5. Saving orchestrator state...")
    orchestrator.save_state("persistent_agent_state.json")
    print("   State saved to: persistent_agent_state.json")

    # Simulate time passing / new session
    print("\n6. Simulating new session...")
    print("   (In production, you could exit and resume later)")
    time.sleep(2)

    # Load orchestrator state
    print("\n7. Loading orchestrator state...")
    orchestrator.load_state("persistent_agent_state.json")
    print("   State loaded.")

    # Resume the agent
    print("\n8. Resuming agent...")
    orchestrator.resume_agent(agent_id)
    print("   Agent resumed.")

    # Second query on resumed agent
    print("\n9. Sending second query to resumed agent...")
    query2 = "What was Apple's revenue in the last quarter?"
    result2 = orchestrator.query_agent(agent_id, query2)

    if result2["success"]:
        print(f"   Answer: {result2['answer'][:100]}...")
    else:
        print(f"   Error: {result2.get('error')}")

    # Display agent statistics
    print("\n10. Agent Statistics:")
    info = orchestrator.get_agent_info(agent_id)
    print(f"    Name: {info['agent_name']}")
    print(f"    Status: {info['status']}")
    print(f"    Total Queries: {info['query_count']}")
    print(f"    Created: {info['created_at']}")
    if 'paused_at' in info:
        print(f"    Last Paused: {info['paused_at']}")
    if 'resumed_at' in info:
        print(f"    Last Resumed: {info['resumed_at']}")

    # Cleanup
    print("\n11. Cleanup:")
    choice = input("    Terminate agent? (y/n): ").lower()

    if choice == 'y':
        orchestrator.terminate_agent(agent_id)
        print("    Agent terminated.")
    else:
        print("    Agent left running.")
        print(f"    Agent ID: {agent_id}")
        print("    You can reconnect using this ID.")

    print("\n" + "=" * 60)
    print("Persistent Agent Example Completed!")
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
