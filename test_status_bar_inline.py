"""
Test script demonstrating the inline status bar behavior.
All intermediate steps update on the same line, with only the final step showing completion.
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


def test_inline_updates():
    """
    Test that demonstrates the inline update behavior.
    
    Expected behavior:
    - Each phase replaces the previous one on the same line
    - Only the final phase (generating) shows a checkmark and moves to new line
    - Creates a smooth, clean progress indication
    """
    print("\n=== Single-Line Status Updates Test ===\n")
    print("Watch how the status updates on a single line:\n")
    
    status_bar = get_status_bar()
    
    # 1. Planning - shows briefly then transitions
    status_bar.start_phase(StatusPhase.PLANNING, "Planning tasks...")
    time.sleep(1.5)
    status_bar.complete_phase("Tasks planned", show_completion=False)
    
    # Small delay to show transition
    time.sleep(0.2)
    
    # 2. Thinking - replaces planning on same line
    status_bar.start_phase(StatusPhase.THINKING, "Analyzing request...")
    time.sleep(1.5)
    status_bar.complete_phase("", show_completion=False)
    
    time.sleep(0.2)
    
    # 3. Executing - replaces thinking on same line
    status_bar.start_phase(
        StatusPhase.EXECUTING, 
        "Executing get_crypto_prices...",
        details=""
    )
    time.sleep(1)
    status_bar.update_details("(fetching BTC, ETH)")
    time.sleep(1)
    status_bar.complete_phase("", show_completion=False)
    
    time.sleep(0.2)
    
    # 4. Another execution
    status_bar.start_phase(
        StatusPhase.EXECUTING,
        "Executing visualize_crypto_chart...",
        details=""
    )
    time.sleep(1)
    status_bar.update_details("(generating chart)")
    time.sleep(1)
    status_bar.complete_phase("", show_completion=False)
    
    time.sleep(0.2)
    
    # 5. Validation
    status_bar.start_phase(StatusPhase.VALIDATING, "Validating results...")
    time.sleep(1)
    status_bar.complete_phase("", show_completion=False)
    
    time.sleep(0.2)
    
    # 6. Final phase - shows completion with newline
    status_bar.start_phase(StatusPhase.GENERATING, "Generating answer...")
    time.sleep(2)
    status_bar.complete_phase("Answer ready", show_completion=True)
    
    print("\n✓ Inline test completed!\n")


def test_with_decorators():
    """Test using decorators with inline behavior."""
    print("\n=== Decorator-Based Inline Updates ===\n")
    print("All steps update on the same line until final completion:\n")
    
    @with_planning()
    def plan():
        time.sleep(1.5)
    
    @with_thinking("Analyzing query...")
    def think():
        time.sleep(1.5)
    
    @with_executing("Executing get_crypto_prices...")
    def execute_prices():
        time.sleep(1.5)
    
    @with_executing("Executing visualize_crypto_chart...")
    def execute_chart():
        time.sleep(1.5)
    
    @with_validating("Validating results...")
    def validate():
        time.sleep(1)
    
    @with_generating()  # This one shows completion!
    def generate():
        time.sleep(2)
    
    # Execute all - watch them flow on one line
    plan()
    time.sleep(0.2)
    
    think()
    time.sleep(0.2)
    
    execute_prices()
    time.sleep(0.2)
    
    execute_chart()
    time.sleep(0.2)
    
    validate()
    time.sleep(0.2)
    
    generate()  # Final step shows checkmark and newline
    
    print("\n✓ Decorator test completed!\n")


def test_complete_workflow():
    """Test a complete agent workflow with realistic messages."""
    print("\n=== Complete Agent Workflow Simulation ===\n")
    print("Simulating a real agent execution:\n")
    
    status_bar = get_status_bar()
    
    # Planning
    status_bar.start_phase(StatusPhase.PLANNING, "Planning tasks...")
    time.sleep(1.5)
    status_bar.complete_phase("", show_completion=False)
    time.sleep(0.3)
    
    # Multiple tool executions
    tools = [
        ("get_crypto_prices", "(fetching BTC, ETH, SOL)"),
        ("get_market_info", "(analyzing market data)"),
        ("visualize_crypto_chart", "(generating 30-day chart)"),
    ]
    
    for tool_name, detail in tools:
        status_bar.start_phase(
            StatusPhase.EXECUTING,
            f"Executing {tool_name}...",
            details=""
        )
        time.sleep(0.8)
        status_bar.update_details(detail)
        time.sleep(0.8)
        status_bar.complete_phase("", show_completion=False)
        time.sleep(0.3)
    
    # Validation
    status_bar.start_phase(StatusPhase.VALIDATING, "Validating results...")
    time.sleep(1)
    status_bar.complete_phase("", show_completion=False)
    time.sleep(0.3)
    
    # Final answer generation - shows completion
    status_bar.start_phase(StatusPhase.GENERATING, "Generating answer...")
    time.sleep(2)
    status_bar.complete_phase("Answer ready", show_completion=True)
    
    print("\n✓ Workflow simulation completed!\n")


def test_with_memory_save():
    """Test with additional status messages like memory saves."""
    print("\n=== Workflow with Memory Save ===\n")
    print("Showing how to handle additional messages:\n")
    
    status_bar = get_status_bar()
    
    # Planning
    status_bar.start_phase(StatusPhase.PLANNING, "Planning tasks...")
    time.sleep(1)
    status_bar.complete_phase("", show_completion=False)
    time.sleep(0.2)
    
    # Executing
    status_bar.start_phase(StatusPhase.EXECUTING, "Executing get_crypto_prices...")
    time.sleep(1.5)
    status_bar.complete_phase("", show_completion=False)
    time.sleep(0.2)
    
    # Validating
    status_bar.start_phase(StatusPhase.VALIDATING, "Validating results...")
    time.sleep(1)
    status_bar.complete_phase("", show_completion=False)
    time.sleep(0.2)
    
    # Generating
    status_bar.start_phase(StatusPhase.GENERATING, "Generating answer...")
    time.sleep(1.5)
    
    # Memory save happens during generation - we can show it inline
    status_bar.update_details("💾 Memory saved")
    time.sleep(0.5)
    
    status_bar.complete_phase("Answer ready", show_completion=True)
    
    print("\n✓ Memory save test completed!\n")


def test_transition_method():
    """Test the smooth transition_to method."""
    print("\n=== Smooth Transitions Test ===\n")
    print("Using transition_to for seamless phase changes:\n")
    
    status_bar = get_status_bar()
    
    # Start with planning
    status_bar.start_phase(StatusPhase.PLANNING, "Planning tasks...")
    time.sleep(1)
    
    # Transition directly to thinking
    status_bar.transition_to(StatusPhase.THINKING, "Analyzing request...")
    time.sleep(1)
    
    # Transition to executing
    status_bar.transition_to(StatusPhase.EXECUTING, "Executing get_crypto_prices...")
    time.sleep(1)
    
    # Transition to another execution
    status_bar.transition_to(StatusPhase.EXECUTING, "Executing visualize_crypto_chart...")
    time.sleep(1)
    
    # Transition to validating
    status_bar.transition_to(StatusPhase.VALIDATING, "Validating results...")
    time.sleep(1)
    
    # Transition to generating and complete
    status_bar.transition_to(StatusPhase.GENERATING, "Generating answer...")
    time.sleep(1.5)
    status_bar.complete_phase("Answer ready", show_completion=True)
    
    print("\n✓ Transitions test completed!\n")


def main():
    """Run all inline tests."""
    print("\n" + "="*60)
    print("   MAXIMUS INLINE STATUS BAR TEST SUITE")
    print("="*60)
    print("\nThese tests demonstrate single-line status updates.")
    print("Only the final step shows completion and moves to a new line.\n")
    
    test_inline_updates()
    time.sleep(1)
    
    test_with_decorators()
    time.sleep(1)
    
    test_complete_workflow()
    time.sleep(1)
    
    test_with_memory_save()
    time.sleep(1)
    
    test_transition_method()
    
    print("\n" + "="*60)
    print("   ALL INLINE TESTS COMPLETED")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()

