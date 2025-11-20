from typing import List

from langchain_core.messages import AIMessage

from dexter.model import call_llm, call_llm_stream
from dexter.prompts import (
    ACTION_SYSTEM_PROMPT,
    get_answer_system_prompt,
    PLANNING_SYSTEM_PROMPT,
    get_tool_args_system_prompt,
    VALIDATION_SYSTEM_PROMPT,
    META_VALIDATION_SYSTEM_PROMPT,
)
from dexter.schemas import Answer, IsDone, OptimizedToolArgs, Task, TaskList
from dexter.tools import TOOLS
from dexter.utils.logger import Logger
from dexter.utils.ui import show_progress
from dexter.utils.context import ContextManager


class Agent:
    def __init__(self, max_steps: int = 20, max_steps_per_task: int = 5):
        self.logger = Logger()
        self.max_steps = max_steps            # global safety cap
        self.max_steps_per_task = max_steps_per_task
        self.context_manager = ContextManager()

    # ---------- task planning ----------
    @show_progress("Planning tasks...", "Tasks planned")
    def plan_tasks(self, query: str) -> List[Task]:
        tool_descriptions = "\n".join([f"- {t.name}: {t.description}" for t in TOOLS])
        prompt = f"""
        Given the user query: "{query}",
        Create a list of tasks to be completed.
        Example: {{"tasks": [{{"id": 1, "description": "some task", "done": false}}]}}
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
    @show_progress("Thinking...", "")
    def ask_for_actions(self, task_desc: str, last_outputs: str = "") -> AIMessage:
        # last_outputs = textual feedback of what we just tried
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
    @show_progress("Checking if task is complete...", "")
    def ask_if_done(self, task_desc: str, recent_results: str) -> bool:
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

    # ---------- ask LLM if main goal is achieved ----------
    @show_progress("Checking if main goal is achieved...", "")
    def is_goal_achieved(self, query: str, task_outputs: list, tasks: List[Task]) -> bool:
        """Check if the overall goal is achieved based on all session outputs and planned tasks."""
        all_results = "\n\n".join(task_outputs) if task_outputs else "No data collected yet."
        
        # Format tasks for cross-reference
        tasks_info = []
        for task in tasks:
            status = "✓ Done" if task.done else "✗ Not done"
            tasks_info.append(f"- [{status}] {task.description}")
        tasks_summary = "\n".join(tasks_info) if tasks_info else "No tasks were planned."
        
        prompt = f"""
        Original user query: "{query}"
        
        Planned tasks (for cross-reference only - not a hard requirement):
        {tasks_summary}
        
        Data and results collected from tools so far:
        {all_results}
        
        Based on the data above, is the original user query sufficiently answered?
        Use the tasks as a helpful cross-reference, but prioritize whether the query itself is answered.
        """
        try:
            resp = call_llm(prompt, system_prompt=META_VALIDATION_SYSTEM_PROMPT, output_schema=IsDone)
            return resp.done
        except Exception as e:
            self.logger._log(f"Meta-validation failed: {e}")
            return False

    # ---------- optimize tool arguments ----------
    @show_progress("Optimizing tool call...", "")
    def optimize_tool_args(self, tool_name: str, initial_args: dict, task_desc: str) -> dict:
        """Optimize tool arguments based on task requirements."""
        tool = next((t for t in TOOLS if t.name == tool_name), None)
        if not tool:
            return initial_args
        
        # Get tool schema info
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
            response = call_llm(prompt, model="gpt-4.1", system_prompt=get_tool_args_system_prompt(), output_schema=OptimizedToolArgs)
            # Handle case where LLM returns dict directly instead of OptimizedToolArgs
            if isinstance(response, dict):
                return response if response else initial_args
            return response.arguments
        except Exception as e:
            self.logger._log(f"Argument optimization failed: {e}, using original args")
            return initial_args

    # ---------- tool execution ----------
    def _execute_tool(self, tool, tool_name: str, inp_args):
        """Execute a tool with progress indication."""
        # Create a dynamic decorator with the tool name
        @show_progress(f"Executing {tool_name}...", "")
        def run_tool():
            return tool.run(inp_args)
        return run_tool()
    
    # ---------- confirm action ----------
    def confirm_action(self, tool: str, input_str: str) -> bool:
        # In production you'd ask the user; here we just log and auto-confirm
        # Risky tools are not implemented in this version.
        return True

    # ---------- main loop ----------
    def run(self, query: str):
        """
        Executes the main agent loop to process a user query.

        This method orchestrates the entire process of understanding a query,
        planning tasks, executing tools to gather information, and synthesizing
        a final answer.

        Args:
            query (str): The user's natural language query.

        Returns:
            str: A comprehensive answer to the user's query.
        """
        # Display the user's query
        self.logger.log_user_query(query)
        
        # Initialize agent state for this run.
        step_count = 0
        last_actions = []
        task_output_summaries = [] # lightweight summaries for introspection (full outputs offloaded to files)

        # 1. Decompose the user query into a list of tasks.
        tasks = self.plan_tasks(query)

        # If no tasks were created, the query is likely out of scope.
        if not tasks:
            # Note: _generate_answer now streams and displays the answer directly
            answer = self._generate_answer(query, [])
            return answer

        # 2. Loop through tasks until all are complete or max steps are reached.
        while any(not t.done for t in tasks):
            # Global safety break.
            if step_count >= self.max_steps:
                self.logger._log("Global max steps reached — aborting to avoid runaway loop.")
                break

            # Select the next incomplete task.
            task = next(t for t in tasks if not t.done)
            self.logger.log_task_start(task.description)

            # Define per-task step variables.
            per_task_steps = 0
            task_step_summaries = [] # lightweight summaries for task-level introspection

            # Loop through steps of a single task until the task is complete or the max steps are reached.
            while per_task_steps < self.max_steps_per_task:
                if step_count >= self.max_steps:
                    self.logger._log("Global max steps reached — stopping.")
                    return

                # Ask the LLM for the next action to take for the current task.
                ai_message = self.ask_for_actions(task.description, last_outputs="\n".join(task_step_summaries))
                
                # If no tool is called, the task is considered complete.
                if not ai_message.tool_calls:
                    task.done = True
                    self.logger.log_task_done(task.description)
                    break

                # Process each tool call returned by the LLM.
                for tool_call in ai_message.tool_calls:
                    if step_count >= self.max_steps:
                        break

                    tool_name = tool_call["name"]
                    initial_args = tool_call["args"]
                    
                    # Refine tool arguments for better performance.
                    optimized_args = self.optimize_tool_args(tool_name, initial_args, task.description)
                    
                    # Create a signature of the action to be taken.
                    action_sig = f"{tool_name}:{optimized_args}"

                    # Detect and prevent repetitive action loops.
                    last_actions.append(action_sig)
                    if len(last_actions) > 4:
                        last_actions = last_actions[-4:]
                    if len(set(last_actions)) == 1 and len(last_actions) == 4:
                        self.logger._log("Detected repeating action — aborting to avoid loop.")
                        return
                    
                    # Execute the tool.
                    tool_to_run = next((t for t in TOOLS if t.name == tool_name), None)
                    if tool_to_run and self.confirm_action(tool_name, str(optimized_args)):
                        try:
                            result = self._execute_tool(tool_to_run, tool_name, optimized_args)
                            self.logger.log_tool_run(optimized_args, result)
                            
                            # Offload tool output to file immediately
                            context_path = self.context_manager.save_context(
                                tool_name=tool_name,
                                args=optimized_args,
                                result=result,
                                task_id=task.id
                            )
                            
                            # Store lightweight summary for introspection calls
                            pointer = self.context_manager.pointers[-1]  # Get the just-added pointer
                            summary = f"Output of {tool_name} with args {optimized_args}: {pointer['summary']}"
                            task_output_summaries.append(summary)
                            task_step_summaries.append(summary)
                        except Exception as e:
                            self.logger._log(f"Tool execution failed: {e}")
                            error_summary = f"Error from {tool_name} with args {optimized_args}: {e}"
                            task_output_summaries.append(error_summary)
                            task_step_summaries.append(error_summary)
                    else:
                        self.logger._log(f"Invalid tool: {tool_name}")

                    step_count += 1
                    per_task_steps += 1

                # Task-level introspection: Check if the task is complete.
                if self.ask_if_done(task.description, "\n".join(task_step_summaries)):
                    task.done = True
                    self.logger.log_task_done(task.description)
                    break
            
            # Global introspection: Check if the overall goal is achieved.
            if task.done and self.is_goal_achieved(query, task_output_summaries, tasks):
                self.logger._log("Main goal achieved. Finalizing answer.")
                break

        # Generate the final answer using context selection and loading
        # Note: _generate_answer now streams and displays the answer directly
        answer = self._generate_answer(query)
        return answer
    
    # ---------- answer generation ----------
    def _generate_answer(self, query: str) -> str:
        """Generate the final answer based on collected data, streaming the output."""
        # Get all available context pointers
        all_pointers = self.context_manager.get_all_pointers()
        
        if not all_pointers:
            # No data collected
            answer_prompt = f"""
            Original user query: "{query}"
            
            No data was collected from tools.
            """
        else:
            # Select relevant contexts using LLM
            selected_filepaths = self.context_manager.select_relevant_contexts(query, all_pointers)
            
            # Load selected contexts
            selected_contexts = self.context_manager.load_contexts(selected_filepaths)
            
            # Format loaded contexts for the prompt
            formatted_results = []
            for ctx in selected_contexts:
                tool_name = ctx.get("tool_name", "unknown")
                args = ctx.get("args", {})
                result = ctx.get("result", {})
                formatted_results.append(f"Output of {tool_name} with args {args}:\n{result}")
            
            all_results = "\n\n".join(formatted_results) if formatted_results else "No relevant data was selected."
            
            answer_prompt = f"""
            Original user query: "{query}"
            
            Data and results collected from tools:
            {all_results}
            
            Based on the data above, provide a comprehensive answer to the user's query.
            Include specific numbers, calculations, and insights.
            """
        
        # Stream the answer and display it in real-time
        text_chunks = call_llm_stream(answer_prompt, system_prompt=get_answer_system_prompt())
        accumulated_answer = self.logger.ui.stream_answer(text_chunks)
        
        return accumulated_answer
