from typing import List, Optional

from langchain_core.messages import AIMessage

from maximus.model import call_llm
from maximus.prompts import (
    ACTION_SYSTEM_PROMPT,
    get_answer_system_prompt,
    PLANNING_SYSTEM_PROMPT,
    get_tool_args_system_prompt,
    VALIDATION_SYSTEM_PROMPT,
)
from maximus.schemas import Answer, IsDone, OptimizedToolArgs, Task, TaskList
from maximus.tools import TOOLS
from maximus.tools.memory import add_memory, retrieve_context
from maximus.utils.logger import Logger
from maximus.utils.status_bar import (
    get_status_bar,
    StatusPhase,
    with_planning,
    with_thinking,
    with_optimizing,
    with_validating,
    with_generating,
)


class Agent:
    def __init__(self, max_steps: int = 20, max_steps_per_task: int = 5, session_id: Optional[str] = None):
        self.logger = Logger()
        self.max_steps = max_steps            # global safety cap
        self.max_steps_per_task = max_steps_per_task
        self.session_id = session_id          # unique identifier for memory isolation
        self.status_bar = get_status_bar()    # inline status bar for progress

    # ---------- task planning ----------
    @with_planning("Planning tasks...", "Tasks planned")
    def plan_tasks(self, query: str, memories: List[str] = None) -> List[Task]:
        tool_descriptions = "\n".join([f"- {t.name}: {t.description}" for t in TOOLS])
        
        # Include memory context if available
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
    @with_validating("Validating...", "")
    def ask_if_done(self, task_desc: str, recent_results: str) -> bool:
        prompt = f"""
        We were trying to complete the task: "{task_desc}".
        Here is a history of tool outputs from the session so far: {recent_results}

        Is the task done?
        """
        try:
            resp = call_llm(prompt, system_prompt=VALIDATION_SYSTEM_PROMPT, output_schema=IsDone)
            return resp.done
        except Exception as e:
            self.logger._log(f"Task validation failed: {e}")
            return False

    # ---------- optimize tool arguments ----------
    @with_optimizing("Optimizing tool call...", "")
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
            response = call_llm(prompt, system_prompt=get_tool_args_system_prompt(), output_schema=OptimizedToolArgs)
            # Handle case where LLM returns dict directly instead of OptimizedToolArgs
            if isinstance(response, dict):
                return response if response else initial_args
            return response.arguments
        except Exception as e:
            self.logger._log(f"Argument optimization failed: {e}, using original args")
            return initial_args

    # ---------- tool execution ----------
    def _execute_tool(self, tool, tool_name: str, inp_args):
        """Execute a tool with inline status bar indication."""
        # Start the execution phase
        self.status_bar.start_phase(
            StatusPhase.EXECUTING,
            f"Executing {tool_name}...",
            details=""
        )
        
        try:
            result = tool.run(inp_args)
            # Complete without showing result (clean transition)
            self.status_bar.complete_phase("", show_completion=False)
            return result
        except Exception as e:
            self.status_bar.error_phase(f"{tool_name} failed: {str(e)}", show_on_newline=True)
            raise
    
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
        
        # Retrieve relevant context from memory if session exists
        retrieved_memories = []
        if self.session_id:
            retrieved_memories = retrieve_context(self.session_id, query, limit=5)
        
        # Initialize agent state for this run.
        step_count = 0
        last_actions = []
        session_outputs = []
        max_steps_reached = False  # Track if we hit the global limit

        # 1. Decompose the user query into a list of tasks.
        tasks = self.plan_tasks(query, memories=retrieved_memories)

        # If no tasks were created, the query is likely out of scope.
        if not tasks:
            answer = self._generate_answer(query, session_outputs, memories=retrieved_memories)
            self.logger.log_summary(answer)
            return answer

        # 2. Execute tasks until all are complete or max steps are reached.
        while any(not t.done for t in tasks):
            # Global safety break.
            if step_count >= self.max_steps:
                self.logger._log("Global max steps reached — aborting to avoid runaway loop.")
                break

            # Select the next incomplete task.
            task = next(t for t in tasks if not t.done)
            self.logger.log_task_start(task.description)

            # Loop for a single task, with its own step limit.
            per_task_steps = 0
            task_outputs = []
            while per_task_steps < self.max_steps_per_task:
                if step_count >= self.max_steps:
                    self.logger._log("Global max steps reached — generating partial answer from collected data.")
                    max_steps_reached = True
                    break

                # Ask the LLM for the next action to take for the current task.
                ai_message = self.ask_for_actions(task.description, last_outputs="\n".join(task_outputs))
                
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

                # After a batch of tool calls, check if the task is complete.
                if self.ask_if_done(task.description, "\n".join(task_outputs)):
                    task.done = True
                    self.logger.log_task_done(task.description)
                    break
            
            # If max steps reached, exit the task loop to generate partial answer
            if max_steps_reached:
                break

        # 3. Synthesize the final answer from all collected tool outputs.
        answer = self._generate_answer(query, session_outputs, memories=retrieved_memories, partial=max_steps_reached)
        self.logger.log_summary(answer)
        return answer
    
    # ---------- answer generation ----------
    @with_generating("Generating answer...", "Answer ready")
    def _generate_answer(self, query: str, session_outputs: list, memories: List[str] = None, partial: bool = False) -> str:
        """Generate the final answer based on collected data and conversation history."""
        all_results = "\n\n".join(session_outputs) if session_outputs else "No data was collected."
        
        # Include memory context if available
        memory_context = ""
        if memories:
            memory_context = f"""
        
        Previous conversation context:
        {chr(10).join([f"- {m}" for m in memories])}
        """
        
        # Add partial result context if applicable
        partial_context = ""
        if partial:
            partial_context = """
        
        IMPORTANT: The analysis reached the maximum step limit before completing all planned tasks.
        Please provide a partial answer based on the data collected so far, and clearly indicate:
        1. That this is a partial result due to step limits
        2. What data was successfully gathered
        3. What aspects of the query may not be fully addressed
        """
        
        answer_prompt = f"""
        Original user query: "{query}"
        {memory_context}
        {partial_context}
        
        Data and results collected from tools:
        {all_results}
        
        Based on the data above and any relevant conversation history, provide a comprehensive answer to the user's query.
        Include specific numbers, calculations, and insights.
        If the user is asking about something from our previous conversation, use the context to answer.
        """
        answer_obj = call_llm(answer_prompt, system_prompt=get_answer_system_prompt(), output_schema=Answer)
        answer = answer_obj.answer
        
        # Store the query and answer in memory if session exists
        if self.session_id:
            # Complete the generating phase without showing completion yet
            self.status_bar.is_animating = False
            if self.status_bar.animation_thread:
                self.status_bar.animation_thread.join()
            
            # Show memory save on its own line
            from maximus.utils.ui import Colors
            import sys
            sys.stdout.write(f"\r{' ' * 120}\r")
            sys.stdout.flush()
            
            memory_text = f"User asked: {query}\nMaximus answered: {answer}"
            add_memory(self.session_id, memory_text)
            
            # Print memory saved on its own line
            print(f"{Colors.GREEN}✓{Colors.ENDC} Memory saved successfully")
        
        return answer
