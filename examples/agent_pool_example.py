"""
Agent Pool Example

This example demonstrates:
1. Creating a pool of parallel agents
2. Distributing queries across the pool
3. Collecting and aggregating results
"""

import logging
import sys
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

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
    """Run agent pool example"""

    print("=" * 60)
    print("Agent Pool Example - Parallel Query Processing")
    print("=" * 60)

    # Initialize orchestrator
    print("\n1. Initializing orchestrator...")
    orchestrator = RemoteAgentOrchestrator()

    # Define queries to process in parallel
    queries = [
        "What was Apple's revenue for Q1 2024?",
        "What was Microsoft's revenue for Q1 2024?",
        "What was Google's revenue for Q1 2024?",
        "What was Amazon's revenue for Q1 2024?",
        "What was Meta's revenue for Q1 2024?",
    ]

    print(f"\n2. Creating agent pool (size: {len(queries)})...")
    agent_pool = orchestrator.create_agent_pool(size=len(queries), persistent=False)

    if len(agent_pool) < len(queries):
        print(f"   Warning: Only {len(agent_pool)} agents created")
        queries = queries[:len(agent_pool)]

    print(f"   Successfully created {len(agent_pool)} agents")

    # Process queries in parallel
    print(f"\n3. Processing {len(queries)} queries in parallel...")
    print("-" * 60)

    results = []

    with ThreadPoolExecutor(max_workers=len(agent_pool)) as executor:
        # Submit all queries
        future_to_query = {
            executor.submit(
                orchestrator.query_agent,
                agent_id,
                query
            ): (agent_id, query)
            for agent_id, query in zip(agent_pool, queries)
        }

        # Collect results as they complete
        for future in as_completed(future_to_query):
            agent_id, query = future_to_query[future]

            try:
                result = future.result()
                results.append(result)

                status = "✓" if result["success"] else "✗"
                print(f"{status} {query[:50]}...")

            except Exception as e:
                logger.error(f"Query failed: {e}")
                results.append({
                    "success": False,
                    "query": query,
                    "error": str(e),
                    "agent_id": agent_id
                })

    print("-" * 60)

    # Display detailed results
    print("\n4. Detailed Results:")
    print("=" * 60)

    for i, result in enumerate(results, 1):
        print(f"\nQuery {i}: {result['query']}")
        print("-" * 60)

        if result["success"]:
            print(f"Answer: {result['answer'][:200]}...")
        else:
            print(f"Error: {result.get('error', 'Unknown error')}")

        print("-" * 60)

    # Summary
    successful = sum(1 for r in results if r["success"])
    print(f"\n5. Summary:")
    print(f"   Total Queries: {len(results)}")
    print(f"   Successful: {successful}")
    print(f"   Failed: {len(results) - successful}")

    # Cleanup
    print("\n6. Cleaning up agent pool...")
    for agent_id in agent_pool:
        try:
            orchestrator.terminate_agent(agent_id)
            print(f"   Terminated: {agent_id}")
        except Exception as e:
            logger.error(f"Failed to terminate {agent_id}: {e}")

    print("\n" + "=" * 60)
    print("Agent Pool Example Completed!")
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
