import asyncio
from typing import List

from langchain_core.messages import AIMessage

from dexter.model import call_llm, call_llm_async
from dexter.prompts import (
    ACTION_SYSTEM_PROMPT,
    ANSWER_SYSTEM_PROMPT,
    PLANNING_SYSTEM_PROMPT,
    TOOL_ARGS_SYSTEM_PROMPT,
    VALIDATION_SYSTEM_PROMPT,
)
from dexter.schemas import Answer, IsDone, OptimizedToolArgs, Task, TaskList
from dexter.tools import TOOLS
from dexter.utils.logger import Logger
from dexter.utils.ui import show_progress


class Agent:
    def __init__(self, max_steps: int = 20, max_steps_per_task: int = 5):
        self.logger = Logger()
        self.max_steps = max_steps            # global safety cap
        self.max_steps_per_task = max_steps_per_task

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
    async def ask_for_actions_async(self, task_desc: str, last_outputs: str = "") -> AIMessage:
        """
        Asynchronously ask the LLM for the next actions to take for a task.

        Args:
            task_desc: Description of the current task
            last_outputs: History of previous tool outputs

        Returns:
            AIMessage: LLM response with tool calls or content

        Raises:
            RuntimeError: If LLM call fails after retries
        """
        if not task_desc or not isinstance(task_desc, str):
            raise ValueError("Task description must be a non-empty string")

        prompt = f"""
        We are working on: "{task_desc}".
        Here is a history of tool outputs from the session so far: {last_outputs}

        Based on the task and the outputs, what should be the next step?
        """
        try:
            return await call_llm_async(prompt, system_prompt=ACTION_SYSTEM_PROMPT, tools=TOOLS)
        except Exception as e:
            error_msg = f"Failed to get actions for task '{task_desc}': {e}"
            self.logger._log(error_msg)
            # Return a message that will cause task completion
            return AIMessage(content=f"Unable to determine next actions: {e}")

    def ask_for_actions(self, task_desc: str, last_outputs: str = "") -> AIMessage:
        """Synchronous wrapper for backward compatibility."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(asyncio.run, self.ask_for_actions_async(task_desc, last_outputs))
                    return future.result()
            else:
                return loop.run_until_complete(self.ask_for_actions_async(task_desc, last_outputs))
        except RuntimeError:
            return asyncio.run(self.ask_for_actions_async(task_desc, last_outputs))

    # ---------- ask LLM if task is done ----------
    @show_progress("Validating...", "")
    async def ask_if_done_async(self, task_desc: str, recent_results: str) -> bool:
        """
        Asynchronously ask the LLM if a task is completed based on recent results.

        Args:
            task_desc: Description of the task being validated
            recent_results: Recent tool outputs to evaluate

        Returns:
            bool: True if task is done, False otherwise
        """
        if not task_desc or not isinstance(task_desc, str):
            raise ValueError("Task description must be a non-empty string")

        prompt = f"""
        We were trying to complete the task: "{task_desc}".
        Here is a history of tool outputs from the session so far: {recent_results}

        Is the task done?
        """
        try:
            resp = await call_llm_async(prompt, system_prompt=VALIDATION_SYSTEM_PROMPT, output_schema=IsDone)
            return resp.done
        except Exception as e:
            self.logger._log(f"Validation failed for task '{task_desc}': {e}")
            # Default to False (not done) on validation failure to avoid premature completion
            return False

    def ask_if_done(self, task_desc: str, recent_results: str) -> bool:
        """Synchronous wrapper for backward compatibility."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(asyncio.run, self.ask_if_done_async(task_desc, recent_results))
                    return future.result()
            else:
                return loop.run_until_complete(self.ask_if_done_async(task_desc, recent_results))
        except RuntimeError:
            return asyncio.run(self.ask_if_done_async(task_desc, recent_results))

    # ---------- optimize tool arguments ----------
    @show_progress("Optimizing tool call...", "")
    async def optimize_tool_args_async(self, tool_name: str, initial_args: dict, task_desc: str) -> dict:
        """
        Asynchronously optimize tool arguments based on task requirements.

        Args:
            tool_name: Name of the tool being optimized
            initial_args: Initial arguments provided by LLM
            task_desc: Description of the current task

        Returns:
            dict: Optimized arguments for the tool

        Raises:
            ValueError: If tool_name or task_desc are invalid
        """
        if not tool_name or not isinstance(tool_name, str):
            raise ValueError("Tool name must be a non-empty string")
        if not task_desc or not isinstance(task_desc, str):
            raise ValueError("Task description must be a non-empty string")
        if not isinstance(initial_args, dict):
            raise ValueError("Initial arguments must be a dictionary")

        tool = next((t for t in TOOLS if t.name == tool_name), None)
        if not tool:
            self.logger._log(f"Tool '{tool_name}' not found, using original args")
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
            response = await call_llm_async(prompt, system_prompt=TOOL_ARGS_SYSTEM_PROMPT, output_schema=OptimizedToolArgs)
            # Handle case where LLM returns dict directly instead of OptimizedToolArgs
            if isinstance(response, dict):
                return response if response else initial_args
            return response.arguments
        except Exception as e:
            self.logger._log(f"Argument optimization failed for tool '{tool_name}': {e}, using original args")
            return initial_args

    def optimize_tool_args(self, tool_name: str, initial_args: dict, task_desc: str) -> dict:
        """Synchronous wrapper for backward compatibility."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(asyncio.run, self.optimize_tool_args_async(tool_name, initial_args, task_desc))
                    return future.result()
            else:
                return loop.run_until_complete(self.optimize_tool_args_async(tool_name, initial_args, task_desc))
        except RuntimeError:
            return asyncio.run(self.optimize_tool_args_async(tool_name, initial_args, task_desc))

    # ---------- tool execution ----------
    def _execute_tool(self, tool, tool_name: str, inp_args):
        """
        Execute a tool with progress indication and error handling.

        Args:
            tool: The tool object to execute
            tool_name: Name of the tool for logging
            inp_args: Arguments to pass to the tool

        Returns:
            The tool execution result

        Raises:
            RuntimeError: If tool execution fails
        """
        if not tool:
            raise ValueError(f"Tool object is required for {tool_name}")
        if not isinstance(inp_args, dict):
            raise ValueError(f"Tool arguments must be a dictionary for {tool_name}")

        # Create a dynamic decorator with the tool name
        @show_progress(f"Executing {tool_name}...", "")
        def run_tool():
            try:
                return tool.run(inp_args)
            except Exception as e:
                raise RuntimeError(f"Tool '{tool_name}' execution failed: {e}")

        return run_tool()
    
    # ---------- confirm action ----------
    def confirm_action(self, tool: str, input_str: str) -> bool:
        # In production you'd ask the user; here we just log and auto-confirm
        # Risky tools are not implemented in this version.
        return True

    # ---------- main loop ----------
    async def run_async(self, query: str):
        """
        Asynchronously executes the main agent loop to process a user query.

        This method orchestrates the entire process of understanding a query,
        planning tasks, executing tools to gather information, and synthesizing
        a final answer.

        Args:
            query (str): The user's natural language query.

        Returns:
            str: A comprehensive answer to the user's query.

        Raises:
            ValueError: If query is invalid
            RuntimeError: If critical operations fail
        """
        if not query or not isinstance(query, str):
            raise ValueError("Query must be a non-empty string")

        try:
            # Display the user's query
            self.logger.log_user_query(query)

            # Initialize agent state for this run.
            step_count = 0
            last_actions = []
            session_outputs = []

            # 1. Decompose the user query into a list of tasks.
            tasks = self.plan_tasks(query)

            # If no tasks were created, the query is likely out of scope.
            if not tasks:
                answer = await self._generate_answer_async(query, session_outputs)
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
                        self.logger._log("Global max steps reached — stopping.")
                        return await self._generate_answer_async(query, session_outputs)

                    try:
                        # Ask the LLM for the next action to take for the current task.
                        ai_message = await self.ask_for_actions_async(task.description, last_outputs="\n".join(task_outputs))

                        # If no tool is called, the task is considered complete.
                        if not ai_message.tool_calls:
                            task.done = True
                            self.logger.log_task_done(task.description)
                            break

                        # Process each tool call returned by the LLM.
                        for tool_call in ai_message.tool_calls:
                            if step_count >= self.max_steps:
                                break

                            tool_name = tool_call.get("name")
                            initial_args = tool_call.get("args", {})

                            if not tool_name:
                                self.logger._log("Tool call missing name, skipping")
                                continue

                            try:
                                # Refine tool arguments for better performance.
                                optimized_args = await self.optimize_tool_args_async(tool_name, initial_args, task.description)

                                # Create a signature of the action to be taken.
                                action_sig = f"{tool_name}:{optimized_args}"

                                # Detect and prevent repetitive action loops.
                                last_actions.append(action_sig)
                                if len(last_actions) > 4:
                                    last_actions = last_actions[-4:]
                                if len(set(last_actions)) == 1 and len(last_actions) == 4:
                                    self.logger._log("Detected repeating action — aborting to avoid loop.")
                                    return await self._generate_answer_async(query, session_outputs)

                                # Execute the tool.
                                tool_to_run = next((t for t in TOOLS if t.name == tool_name), None)
                                if tool_to_run and self.confirm_action(tool_name, str(optimized_args)):
                                    try:
                                        result = self._execute_tool(tool_to_run, tool_name, optimized_args)
                                        self.logger.log_tool_run(tool_name, f"{result}")
                                        output = f"Output of {tool_name} with args {optimized_args}: {result}"
                                        session_outputs.append(output)
                                        task_outputs.append(output)
                                    except Exception as e:
                                        error_msg = f"Tool execution failed: {e}"
                                        self.logger._log(error_msg)
                                        error_output = f"Error from {tool_name} with args {optimized_args}: {e}"
                                        session_outputs.append(error_output)
                                        task_outputs.append(error_output)
                                else:
                                    self.logger._log(f"Invalid or unconfirmed tool: {tool_name}")

                            except Exception as e:
                                error_msg = f"Error processing tool call {tool_name}: {e}"
                                self.logger._log(error_msg)
                                session_outputs.append(f"Error processing tool call: {error_msg}")
                                task_outputs.append(f"Error processing tool call: {error_msg}")

                            step_count += 1
                            per_task_steps += 1

                        # After a batch of tool calls, check if the task is complete.
                        if await self.ask_if_done_async(task.description, "\n".join(task_outputs)):
                            task.done = True
                            self.logger.log_task_done(task.description)
                            break

                    except Exception as e:
                        error_msg = f"Error in task execution loop for '{task.description}': {e}"
                        self.logger._log(error_msg)
                        session_outputs.append(f"Task execution error: {error_msg}")
                        # Continue to next task rather than failing completely
                        break

            # 3. Synthesize the final answer from all collected tool outputs.
            answer = await self._generate_answer_async(query, session_outputs)
            self.logger.log_summary(answer)
            return answer

        except Exception as e:
            error_msg = f"Critical error in agent execution: {e}"
            self.logger._log(error_msg)
            return f"I encountered an error while processing your query: {e}. Please try again."

    def run(self, query: str):
        """Synchronous wrapper for backward compatibility."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(asyncio.run, self.run_async(query))
                    return future.result()
            else:
                return loop.run_until_complete(self.run_async(query))
        except RuntimeError:
            return asyncio.run(self.run_async(query))
    
    # ---------- answer generation ----------
    @show_progress("Generating answer...", "Answer ready")
    async def _generate_answer_async(self, query: str, session_outputs: list) -> str:
        """
        Asynchronously generate the final answer based on collected data.

        Args:
            query: The original user query
            session_outputs: List of all tool outputs from the session

        Returns:
            str: Comprehensive answer to the user's query

        Raises:
            RuntimeError: If answer generation fails
        """
        if not query or not isinstance(query, str):
            raise ValueError("Query must be a non-empty string")
        if not isinstance(session_outputs, list):
            raise ValueError("Session outputs must be a list")

        try:
            all_results = "\n\n".join(session_outputs) if session_outputs else "No data was collected."
            answer_prompt = f"""
            Original user query: "{query}"

            Data and results collected from tools:
            {all_results}

            Based on the data above, provide a comprehensive answer to the user's query.
            Include specific numbers, calculations, and insights.
            """
            answer_obj = await call_llm_async(answer_prompt, system_prompt=ANSWER_SYSTEM_PROMPT, output_schema=Answer)
            return answer_obj.answer
        except Exception as e:
            error_msg = f"Failed to generate answer: {e}"
            self.logger._log(error_msg)
            # Provide a fallback answer based on available data
            if session_outputs:
                return f"I encountered an error generating the final answer, but here's the raw data I collected:\n\n" + "\n\n".join(session_outputs)
            else:
                return f"I encountered an error and couldn't generate an answer for your query: {query}. Error: {e}"

    def _generate_answer(self, query: str, session_outputs: list) -> str:
        """Synchronous wrapper for backward compatibility."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(asyncio.run, self._generate_answer_async(query, session_outputs))
                    return future.result()
            else:
                return loop.run_until_complete(self._generate_answer_async(query, session_outputs))
        except RuntimeError:
            return asyncio.run(self._generate_answer_async(query, session_outputs))
