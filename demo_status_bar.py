#!/usr/bin/env python3
"""
Simple demo of the inline status bar behavior.
This shows how the status updates on a single line.

Run with: python demo_status_bar.py
"""

import sys
import os

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

import time
from maximus.utils.status_bar import get_status_bar, StatusPhase
from maximus.utils.ui import Colors


def demo_agent_workflow():
    """
    Demonstrate a realistic agent workflow with inline status updates.
    
    Watch how the status line updates in place!
    """
    print("\n" + "="*60)
    print(f"{Colors.BOLD}{Colors.LIGHT_ORANGE}   MAXIMUS INLINE STATUS BAR DEMO{Colors.ENDC}")
    print("="*60)
    
    print(f"\n{Colors.DIM}Watch how the status updates on a single line...{Colors.ENDC}\n")
    
    status_bar = get_status_bar()
    
    # Simulate user query
    print(f"{Colors.BOLD}{Colors.LIGHT_ORANGE}You:{Colors.ENDC} What's the current price of Bitcoin?\n")
    
    time.sleep(1)
    
    # Phase 1: Planning
    status_bar.start_phase(StatusPhase.PLANNING, "Planning tasks...")
    time.sleep(1.5)
    status_bar.complete_phase("", show_completion=False)
    time.sleep(0.3)
    
    # Phase 2: Thinking
    status_bar.start_phase(StatusPhase.THINKING, "Analyzing request...")
    time.sleep(1.2)
    status_bar.complete_phase("", show_completion=False)
    time.sleep(0.3)
    
    # Phase 3: Optimizing
    status_bar.start_phase(StatusPhase.OPTIMIZING, "Optimizing tool parameters...")
    time.sleep(1)
    status_bar.complete_phase("", show_completion=False)
    time.sleep(0.3)
    
    # Phase 4: First tool execution
    status_bar.start_phase(
        StatusPhase.EXECUTING, 
        "Executing get_crypto_prices...",
        details=""
    )
    time.sleep(0.8)
    status_bar.update_details("(fetching BTC, ETH, SOL)")
    time.sleep(1)
    status_bar.complete_phase("", show_completion=False)
    time.sleep(0.3)
    
    # Phase 5: Second tool execution
    status_bar.start_phase(
        StatusPhase.EXECUTING,
        "Executing get_market_info...",
        details=""
    )
    time.sleep(0.8)
    status_bar.update_details("(analyzing market data)")
    time.sleep(1)
    status_bar.complete_phase("", show_completion=False)
    time.sleep(0.3)
    
    # Phase 6: Third tool execution
    status_bar.start_phase(
        StatusPhase.EXECUTING,
        "Executing visualize_crypto_chart...",
        details=""
    )
    time.sleep(0.8)
    status_bar.update_details("(generating 30-day chart)")
    time.sleep(1.2)
    status_bar.complete_phase("", show_completion=False)
    time.sleep(0.3)
    
    # Phase 7: Validation
    status_bar.start_phase(StatusPhase.VALIDATING, "Validating results...")
    time.sleep(1)
    status_bar.complete_phase("", show_completion=False)
    time.sleep(0.3)
    
    # Phase 8: Answer generation with memory save
    status_bar.start_phase(StatusPhase.GENERATING, "Generating answer...")
    time.sleep(1.5)
    status_bar.update_details("💾 Memory saved")
    time.sleep(0.5)
    
    # Final completion - shows checkmark and moves to new line
    status_bar.complete_phase("Answer ready", show_completion=True)
    
    # Show mock answer
    print(f"\n{Colors.BOLD}{Colors.LIGHT_ORANGE}╔{'═' * 58}╗{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.LIGHT_ORANGE}║{'ANSWER'.center(58)}║{Colors.ENDC}")
    print(f"{Colors.LIGHT_ORANGE}╠{'═' * 58}╣{Colors.ENDC}")
    print(f"{Colors.LIGHT_ORANGE}║{Colors.ENDC} {'':56} {Colors.LIGHT_ORANGE}║{Colors.ENDC}")
    print(f"{Colors.LIGHT_ORANGE}║{Colors.ENDC} {'Bitcoin (BTC) is currently trading at $45,234.56.':56} {Colors.LIGHT_ORANGE}║{Colors.ENDC}")
    print(f"{Colors.LIGHT_ORANGE}║{Colors.ENDC} {'Over the past 30 days, the price has increased by':56} {Colors.LIGHT_ORANGE}║{Colors.ENDC}")
    print(f"{Colors.LIGHT_ORANGE}║{Colors.ENDC} {'12.3%, showing strong bullish momentum.':56} {Colors.LIGHT_ORANGE}║{Colors.ENDC}")
    print(f"{Colors.LIGHT_ORANGE}║{Colors.ENDC} {'':56} {Colors.LIGHT_ORANGE}║{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.LIGHT_ORANGE}╚{'═' * 58}╝{Colors.ENDC}\n")
    
    print("="*60)
    print(f"{Colors.GREEN}✓{Colors.ENDC} Demo completed!")
    print("="*60)
    
    print(f"\n{Colors.DIM}Key observations:{Colors.ENDC}")
    print(f"{Colors.DIM}• All status updates happened on a single line{Colors.ENDC}")
    print(f"{Colors.DIM}• Each phase smoothly replaced the previous one{Colors.ENDC}")
    print(f"{Colors.DIM}• Only the final step showed completion with ✓{Colors.ENDC}")
    print(f"{Colors.DIM}• Details updated in real-time (e.g., 'fetching BTC...'){Colors.ENDC}")
    print(f"{Colors.DIM}• Clean, uncluttered progress indication{Colors.ENDC}\n")


def demo_fast_mode():
    """Quick demo showing rapid transitions."""
    print("\n" + "="*60)
    print(f"{Colors.BOLD}{Colors.LIGHT_ORANGE}   RAPID TRANSITIONS DEMO{Colors.ENDC}")
    print("="*60)
    
    print(f"\n{Colors.DIM}Showing rapid phase transitions...{Colors.ENDC}\n")
    
    status_bar = get_status_bar()
    
    phases = [
        (StatusPhase.PLANNING, "Planning tasks..."),
        (StatusPhase.THINKING, "Thinking..."),
        (StatusPhase.EXECUTING, "Executing tool 1..."),
        (StatusPhase.EXECUTING, "Executing tool 2..."),
        (StatusPhase.EXECUTING, "Executing tool 3..."),
        (StatusPhase.VALIDATING, "Validating..."),
    ]
    
    for phase, message in phases:
        status_bar.start_phase(phase, message)
        time.sleep(0.8)
        status_bar.complete_phase("", show_completion=False)
        time.sleep(0.2)
    
    # Final phase
    status_bar.start_phase(StatusPhase.GENERATING, "Generating answer...")
    time.sleep(1)
    status_bar.complete_phase("Answer ready", show_completion=True)
    
    print(f"\n{Colors.GREEN}✓{Colors.ENDC} Rapid demo completed!\n")


def demo_with_error():
    """Demo showing error handling."""
    print("\n" + "="*60)
    print(f"{Colors.BOLD}{Colors.LIGHT_ORANGE}   ERROR HANDLING DEMO{Colors.ENDC}")
    print("="*60)
    
    print(f"\n{Colors.DIM}Showing how errors are handled...{Colors.ENDC}\n")
    
    status_bar = get_status_bar()
    
    # Success
    status_bar.start_phase(StatusPhase.EXECUTING, "Executing safe_tool...")
    time.sleep(1)
    status_bar.complete_phase("", show_completion=False)
    time.sleep(0.3)
    
    # Error
    status_bar.start_phase(StatusPhase.EXECUTING, "Executing risky_tool...")
    time.sleep(1)
    status_bar.error_phase("Failed: Connection timeout", show_on_newline=True)
    time.sleep(0.5)
    
    # Recovery
    status_bar.start_phase(StatusPhase.EXECUTING, "Retrying with backup...")
    time.sleep(1.2)
    status_bar.complete_phase("Backup succeeded", show_completion=True)
    
    print(f"\n{Colors.GREEN}✓{Colors.ENDC} Error handling demo completed!\n")


def main():
    """Run all demos."""
    try:
        # Main demo
        demo_agent_workflow()
        time.sleep(2)
        
        # Fast mode
        demo_fast_mode()
        time.sleep(2)
        
        # Error handling
        demo_with_error()
        
        print("\n" + "="*60)
        print(f"{Colors.BOLD}{Colors.GREEN}   ALL DEMOS COMPLETED!{Colors.ENDC}")
        print("="*60)
        print(f"\n{Colors.DIM}The status bar is ready to integrate with your agent.{Colors.ENDC}")
        print(f"{Colors.DIM}See status_bar_integration_example.py for full integration.{Colors.ENDC}\n")
        
    except KeyboardInterrupt:
        print(f"\n\n{Colors.YELLOW}⚠{Colors.ENDC} Demo interrupted by user.\n")
        sys.exit(0)


if __name__ == "__main__":
    main()

