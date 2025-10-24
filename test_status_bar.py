"""
Test script for the new StatusBar component.
This demonstrates how the status bar updates in real-time as tasks progress.
"""

import time
from src.maximus.utils.status_bar import (
    get_status_bar,
    StatusPhase,
    with_planning,
    with_thinking,
    with_executing,
    with_optimizing,
    with_validating,
    with_generating,
)


# Example 1: Manual status bar usage
def test_manual_status_bar():
    """Test manual control of the status bar."""
    print("\n=== Manual Status Bar Test ===\n")
    
    status_bar = get_status_bar()
    
    # Planning phase
    status_bar.start_phase(StatusPhase.PLANNING, "Planning tasks...")
    time.sleep(2)
    status_bar.complete_phase("Tasks planned")
    
    # Thinking phase
    status_bar.start_phase(StatusPhase.THINKING, "Analyzing request...")
    time.sleep(2)
    status_bar.complete_phase("Analysis complete")
    
    # Executing phase with details
    status_bar.start_phase(
        StatusPhase.EXECUTING, 
        "Executing visualize_crypto_chart...",
        details="(fetching Bitcoin data)"
    )
    time.sleep(2)
    status_bar.update_details("(rendering chart)")
    time.sleep(1)
    status_bar.complete_phase("visualize_crypto_chart ✓")
    
    # Validating phase
    status_bar.start_phase(StatusPhase.VALIDATING, "Validating results...")
    time.sleep(1.5)
    status_bar.complete_phase("Validation complete")
    
    # Generating phase
    status_bar.start_phase(StatusPhase.GENERATING, "Generating answer...")
    time.sleep(2)
    status_bar.complete_phase("Answer ready")
    
    print("\n✓ Manual test completed!\n")


# Example 2: Using decorators
@with_planning()
def plan_tasks():
    """Simulate task planning."""
    time.sleep(2)
    return ["Task 1", "Task 2", "Task 3"]


@with_thinking("Analyzing query...")
def analyze_query():
    """Simulate query analysis."""
    time.sleep(1.5)


@with_executing("Executing get_crypto_prices...", "get_crypto_prices ✓")
def execute_tool():
    """Simulate tool execution."""
    time.sleep(2)
    return {"BTC": 45000, "ETH": 3000}


@with_optimizing("Optimizing parameters...")
def optimize_parameters():
    """Simulate parameter optimization."""
    time.sleep(1)


@with_validating("Validating results...")
def validate_results():
    """Simulate validation."""
    time.sleep(1.5)
    return True


@with_generating()
def generate_answer():
    """Simulate answer generation."""
    time.sleep(2)
    return "Bitcoin is currently trading at $45,000"


def test_decorator_usage():
    """Test decorator-based status bar usage."""
    print("\n=== Decorator Status Bar Test ===\n")
    
    tasks = plan_tasks()
    print(f"  Planned tasks: {tasks}")
    
    analyze_query()
    
    result = execute_tool()
    print(f"  Tool result: {result}")
    
    optimize_parameters()
    
    valid = validate_results()
    print(f"  Validation: {valid}")
    
    answer = generate_answer()
    print(f"  Answer: {answer}")
    
    print("\n✓ Decorator test completed!\n")


# Example 3: Simulating a complete agent workflow
def test_agent_workflow():
    """Test a complete agent workflow simulation."""
    print("\n=== Agent Workflow Test ===\n")
    
    status_bar = get_status_bar()
    
    # 1. Planning
    status_bar.start_phase(StatusPhase.PLANNING, "Planning tasks...")
    time.sleep(1.5)
    status_bar.complete_phase("Tasks planned")
    
    # 2. Execute multiple tools
    tools = [
        "get_crypto_prices",
        "get_market_info", 
        "visualize_crypto_chart"
    ]
    
    for tool in tools:
        status_bar.start_phase(
            StatusPhase.EXECUTING, 
            f"Executing {tool}...",
            details=""
        )
        time.sleep(1)
        
        # Update details mid-execution
        if tool == "visualize_crypto_chart":
            status_bar.update_details("(generating chart)")
            time.sleep(0.5)
        
        status_bar.complete_phase(f"{tool} ✓")
    
    # 3. Validation
    status_bar.start_phase(StatusPhase.VALIDATING, "Validating results...")
    time.sleep(1)
    status_bar.complete_phase("Validation complete")
    
    # 4. Generate answer
    status_bar.start_phase(StatusPhase.GENERATING, "Generating answer...")
    time.sleep(1.5)
    status_bar.complete_phase("Answer ready")
    
    print("\n✓ Workflow test completed!\n")


# Example 4: Error handling
def test_error_handling():
    """Test error handling in status bar."""
    print("\n=== Error Handling Test ===\n")
    
    status_bar = get_status_bar()
    
    # Successful execution
    status_bar.start_phase(StatusPhase.EXECUTING, "Executing safe_tool...")
    time.sleep(1)
    status_bar.complete_phase("safe_tool ✓")
    
    # Failed execution
    status_bar.start_phase(StatusPhase.EXECUTING, "Executing failing_tool...")
    time.sleep(1)
    status_bar.error_phase("Failed: Connection timeout")
    
    # Recovery
    status_bar.start_phase(StatusPhase.EXECUTING, "Retrying with backup...")
    time.sleep(1)
    status_bar.complete_phase("Backup succeeded")
    
    print("\n✓ Error handling test completed!\n")


# Example 5: Rapid updates (stress test)
def test_rapid_updates():
    """Test rapid status updates."""
    print("\n=== Rapid Updates Test ===\n")
    
    status_bar = get_status_bar()
    
    for i in range(10):
        status_bar.start_phase(
            StatusPhase.EXECUTING,
            f"Processing item {i+1}/10...",
            details=""
        )
        time.sleep(0.3)
        status_bar.complete_phase(f"Item {i+1} processed")
    
    print("\n✓ Rapid updates test completed!\n")


def main():
    """Run all tests."""
    print("\n" + "="*60)
    print("   MAXIMUS STATUS BAR TEST SUITE")
    print("="*60)
    
    # Run each test
    test_manual_status_bar()
    time.sleep(1)
    
    test_decorator_usage()
    time.sleep(1)
    
    test_agent_workflow()
    time.sleep(1)
    
    test_error_handling()
    time.sleep(1)
    
    test_rapid_updates()
    
    print("\n" + "="*60)
    print("   ALL TESTS COMPLETED")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()

