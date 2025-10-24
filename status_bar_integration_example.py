"""
Integration example showing how to use the StatusBar component with the Agent.

This file demonstrates how to modify your existing agent.py to use the new
single-line status bar instead of multi-line progress indicators.
"""

from typing import List, Optional
from langchain_core.messages import AIMessage

from src.maximus.model import call_llm
from src.maximus.prompts import (
    ACTION_SYSTEM_PROMPT,
    get_answer_system_prompt,
    PLANNING_SYSTEM_PROMPT,
    get_tool_args_system_prompt,
    VALIDATION_SYSTEM_PROMPT,
)
from src.maximus.schemas import Answer, IsDone, OptimizedToolArgs, Task, TaskList
from src.maximus.tools import TOOLS
from src.maximus.tools.memory import add_memory, retrieve_context
from src.maximus.utils.logger import Logger

# Import the new status bar utilities
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


class AgentWithStatusBar:
    """
    Enhanced Agent that uses the new StatusBar component for progress indication.
    
    This replaces the multi-line progress output with a clean single-line status
    that updates in place as the agent progresses through different phases.
    """
    
    def __init__(self, max_steps: int = 20, max_steps_per_task: int = 5, session_id: Optional[str] = None):
        self.logger = Logger()
        self.max_steps = max_steps
        self.max_steps_per_task = max_steps_per_task
        self.session_id = session_id
        self.status_bar = get_status_bar()

    # ---------- task planning ----------
    @with_planning("Planning tasks...", "Tasks planned")
    def plan_tasks(self, query: str, memories: List[str] = None) -> List[Task]:
        """Plan tasks with status bar indication."""
        tool_descriptions = "\n".join([f"- {t.name}: {t.description}" for t in TOOLS])
        
        context_str = ""
        if memories:
            context_str = "\n\nPrevious conversation context:\n" + "\n".join([f"- {m}" for m in memories])
        
        prompt = f"""
        Given the user query: "{query}",
        Create a list of tasks to be completed.
        Example: {{"tasks": [{{"id": 1, "description": "some task", "done": false}}]}}
        {context_str}
        """
        system_prompt = PLANNING_SYSTEM_PROMPT.format(tools=tool_descriptions)
        try:
            response = call_llm(prompt, system_prompt=system_prompt, output_schema=TaskList)
            tasks = response.tasks
        except Exception as e:
            self.logger._log(f"Planning failed: {e}")
            tasks = [Task(id=1, description=query, done=False)]
        
        task_dicts = [task.dict() for task in tasks]
        self.logger.log_task_list(task_dicts)
        return tasks

    # ---------- ask LLM what to do ----------
    @with_thinking("Thinking...", "")
    def ask_for_actions(self, task_desc: str, last_outputs: str = "") -> AIMessage:
        """Ask for next actions with status indication."""
        prompt = f"""
        We are working on: "{task_desc}".
        Here is a history of tool outputs from the session so far: {last_outputs}

        Based on the task and the outputs, what should be the next step?
        """
        try:
            return call_llm(prompt, system_prompt=ACTION_SYSTEM_PROMPT, tools=TOOLS)
        except Exception as e:
            self.logger._log(f"ask_for_actions failed: {e}")
            return AIMessage(content="Failed to get actions.")

    # ---------- ask LLM if task is done ----------
    @with_validating("Validating...", "")
    def ask_if_done(self, task_desc: str, recent_results: str) -> bool:
        """Validate task completion with status indication."""
        prompt = f"""
        We were trying to complete the task: "{task_desc}".
        Here is a history of tool outputs from the session so far: {recent_results}

        Is the task done?
        """
        try:
            resp = call_llm(prompt, system_prompt=VALIDATION_SYSTEM_PROMPT, output_schema=IsDone)
            return resp.done
        except:
            return False

    # ---------- optimize tool arguments ----------
    @with_optimizing("Optimizing tool call...", "")
    def optimize_tool_args(self, tool_name: str, initial_args: dict, task_desc: str) -> dict:
        """Optimize tool arguments with status indication."""
        tool = next((t for t in TOOLS if t.name == tool_name), None)
        if not tool:
            return initial_args
        
        tool_description = tool.description
        tool_schema = tool.args_schema.schema() if hasattr(tool, 'args_schema') and tool.args_schema else {}
        
        prompt = f"""
        Task: "{task_desc}"
        Tool: {tool_name}
        Tool Description: {tool_description}
        Tool Parameters: {tool_schema}
        Initial Arguments: {initial_args}
        
        Review the task and optimize the arguments to ensure all relevant parameters are used correctly.
        Pay special attention to filtering parameters that would help narrow down results to match the task.
        """
        try:
            response = call_llm(prompt, system_prompt=get_tool_args_system_prompt(), output_schema=OptimizedToolArgs)
            if isinstance(response, dict):
                return response if response else initial_args
            return response.arguments
        except Exception as e:
            self.logger._log(f"Argument optimization failed: {e}, using original args")
            return initial_args

    # ---------- tool execution ----------
    def _execute_tool(self, tool, tool_name: str, inp_args):
        """Execute a tool with status bar indication."""
        # Start the execution phase
        self.status_bar.start_phase(
            StatusPhase.EXECUTING,
            f"Executing {tool_name}...",
            details=""
        )
        
        try:
            result = tool.run(inp_args)
            
            # Don't show completion - just transition to next step
            # The status line will be replaced by the next operation
            self.status_bar.complete_phase("", show_completion=False)
            
            return result
        except Exception as e:
            self.status_bar.error_phase(f"{tool_name} failed: {str(e)}", show_on_newline=True)
            raise
    
    # ---------- confirm action ----------
    def confirm_action(self, tool: str, input_str: str) -> bool:
        """Confirm action execution."""
        return True

    # ---------- main loop ----------
    def run(self, query: str):
        """
        Execute the agent with enhanced status bar visualization.
        
        The status bar will show each phase on a single line that updates in place:
        - ⠸ Planning tasks... → ⠸ Thinking... → ⠸ Executing get_crypto_prices...
        
        Each phase replaces the previous one on the same line.
        Only the final phase (Generating answer) shows ✓ Answer ready on a new line.
        
        This creates a clean, uncluttered progress indication that stays above the input.
        """
        # Display the user's query
        self.logger.log_user_query(query)
        
        # Retrieve relevant context from memory
        retrieved_memories = []
        if self.session_id:
            retrieved_memories = retrieve_context(self.session_id, query, limit=5)
        
        # Initialize state
        step_count = 0
        last_actions = []
        session_outputs = []

        # 1. Plan tasks (status bar shows planning phase)
        tasks = self.plan_tasks(query, memories=retrieved_memories)

        if not tasks:
            answer = self._generate_answer(query, session_outputs, memories=retrieved_memories)
            self.logger.log_summary(answer)
            return answer

        # 2. Execute tasks
        while any(not t.done for t in tasks):
            if step_count >= self.max_steps:
                self.logger._log("Global max steps reached — aborting to avoid runaway loop.")
                break

            task = next(t for t in tasks if not t.done)
            self.logger.log_task_start(task.description)

            per_task_steps = 0
            task_outputs = []
            
            while per_task_steps < self.max_steps_per_task:
                if step_count >= self.max_steps:
                    self.logger._log("Global max steps reached — stopping.")
                    return

                # Ask for actions (thinking phase)
                ai_message = self.ask_for_actions(task.description, last_outputs="\n".join(task_outputs))
                
                if not ai_message.tool_calls:
                    task.done = True
                    self.logger.log_task_done(task.description)
                    break

                # Process tool calls
                for tool_call in ai_message.tool_calls:
                    if step_count >= self.max_steps:
                        break

                    tool_name = tool_call["name"]
                    initial_args = tool_call["args"]
                    
                    # Optimize args (optimizing phase)
                    optimized_args = self.optimize_tool_args(tool_name, initial_args, task.description)
                    
                    # Detect loops
                    action_sig = f"{tool_name}:{optimized_args}"
                    last_actions.append(action_sig)
                    if len(last_actions) > 4:
                        last_actions = last_actions[-4:]
                    if len(set(last_actions)) == 1 and len(last_actions) == 4:
                        self.logger._log("Detected repeating action — aborting to avoid loop.")
                        return
                    
                    # Execute tool (executing phase)
                    tool_to_run = next((t for t in TOOLS if t.name == tool_name), None)
                    if tool_to_run and self.confirm_action(tool_name, str(optimized_args)):
                        try:
                            result = self._execute_tool(tool_to_run, tool_name, optimized_args)
                            self.logger.log_tool_run(tool_name, f"{result}")
                            output = f"Output of {tool_name} with args {optimized_args}: {result}"
                            session_outputs.append(output)
                            task_outputs.append(output)
                        except Exception as e:
                            self.logger._log(f"Tool execution failed: {e}")
                            error_output = f"Error from {tool_name} with args {optimized_args}: {e}"
                            session_outputs.append(error_output)
                            task_outputs.append(error_output)
                    else:
                        self.logger._log(f"Invalid tool: {tool_name}")

                    step_count += 1
                    per_task_steps += 1

                # Validate (validating phase)
                if self.ask_if_done(task.description, "\n".join(task_outputs)):
                    task.done = True
                    self.logger.log_task_done(task.description)
                    break

        # 3. Generate answer (generating phase)
        answer = self._generate_answer(query, session_outputs, memories=retrieved_memories)
        self.logger.log_summary(answer)
        return answer
    
    # ---------- answer generation ----------
    @with_generating("Generating answer...", "Answer ready")
    def _generate_answer(self, query: str, session_outputs: list, memories: List[str] = None) -> str:
        """Generate final answer with status indication."""
        all_results = "\n\n".join(session_outputs) if session_outputs else "No data was collected."
        
        memory_context = ""
        if memories:
            memory_context = f"""
        
        Previous conversation context:
        {chr(10).join([f"- {m}" for m in memories])}
        """
        
        answer_prompt = f"""
        Original user query: "{query}"
        {memory_context}
        
        Data and results collected from tools:
        {all_results}
        
        Based on the data above and any relevant conversation history, provide a comprehensive answer to the user's query.
        Include specific numbers, calculations, and insights.
        If the user is asking about something from our previous conversation, use the context to answer.
        """
        answer_obj = call_llm(answer_prompt, system_prompt=get_answer_system_prompt(), output_schema=Answer)
        answer = answer_obj.answer
        
        # Store in memory
        if self.session_id:
            memory_text = f"User asked: {query}\nMaximus answered: {answer}"
            add_memory(self.session_id, memory_text)
        
        return answer


# Example usage
if __name__ == "__main__":
    print("\n" + "="*60)
    print("   AGENT WITH STATUS BAR - DEMO")
    print("="*60 + "\n")
    
    # Create agent with status bar
    agent = AgentWithStatusBar(session_id="demo_session")
    
    # Run a sample query
    # This will show a single line that updates in place:
    # 
    # ⠸ Planning tasks...
    # (changes to)
    # ⠸ Thinking...
    # (changes to)
    # ⠸ Executing get_crypto_prices...
    # (changes to)
    # ⠸ Executing visualize_crypto_chart...
    # (changes to)
    # ⠸ Validating results...
    # (changes to)
    # ⠸ Generating answer...
    # (finally shows)
    # ✓ Answer ready
    
    print("This is a demonstration of how the status bar would work.")
    print("To actually run it, you need to integrate it with your CLI.\n")

