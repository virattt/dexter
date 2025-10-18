import os
import time
import asyncio
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from pydantic import BaseModel
from typing import Type, List, Optional
from langchain_core.tools import BaseTool
from langchain_core.messages import AIMessage
from openai import APIConnectionError

from dexter.prompts import DEFAULT_SYSTEM_PROMPT

# Validate API key before initializing
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    raise ValueError("OPENAI_API_KEY environment variable is not set. Please set it in your .env file or environment.")

# Initialize the OpenAI client
# Make sure your OPENAI_API_KEY is set in your environment
llm = ChatOpenAI(model="gpt-4.1", temperature=0, api_key=openai_api_key)

async def call_llm_async(
    prompt: str,
    system_prompt: Optional[str] = None,
    output_schema: Optional[Type[BaseModel]] = None,
    tools: Optional[List[BaseTool]] = None,
) -> AIMessage:
    """
    Asynchronously call the LLM with proper error handling and retries.

    Args:
        prompt: The user prompt to send to the LLM
        system_prompt: Optional system prompt to override default
        output_schema: Optional Pydantic schema for structured output
        tools: Optional list of tools to bind to the LLM

    Returns:
        AIMessage: The LLM response

    Raises:
        ValueError: If prompt is empty or invalid
        RuntimeError: If all retry attempts fail
    """
    if not prompt or not isinstance(prompt, str):
        raise ValueError("Prompt must be a non-empty string")

    final_system_prompt = system_prompt if system_prompt else DEFAULT_SYSTEM_PROMPT

    prompt_template = ChatPromptTemplate.from_messages([
        ("system", final_system_prompt),
        ("user", "{prompt}")
    ])

    runnable = llm
    if output_schema:
        runnable = llm.with_structured_output(output_schema, method="function_calling")
    elif tools:
        runnable = llm.bind_tools(tools)

    chain = prompt_template | runnable

    # Retry logic for transient connection errors
    for attempt in range(3):
        try:
            return await chain.ainvoke({"prompt": prompt})
        except APIConnectionError as e:
            if attempt == 2:  # Last attempt
                raise RuntimeError(f"Failed to connect to OpenAI API after 3 attempts: {e}")
            await asyncio.sleep(0.5 * (2 ** attempt))  # 0.5s, 1s backoff
        except Exception as e:
            # Handle other LLM-related errors
            raise RuntimeError(f"LLM call failed: {e}")

def call_llm(
    prompt: str,
    system_prompt: Optional[str] = None,
    output_schema: Optional[Type[BaseModel]] = None,
    tools: Optional[List[BaseTool]] = None,
) -> AIMessage:
    """
    Synchronous wrapper for call_llm_async for backward compatibility.

    This runs the async function in a new event loop to maintain the existing
    synchronous interface while allowing for future async improvements.
    """
    try:
        # Try to get the current event loop
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If there's already a running loop, we need to handle this differently
            # For now, create a new thread with its own event loop
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, call_llm_async(
                    prompt, system_prompt, output_schema, tools
                ))
                return future.result()
        else:
            # Use the existing loop
            return loop.run_until_complete(call_llm_async(
                prompt, system_prompt, output_schema, tools
            ))
    except RuntimeError:
        # No event loop exists, create one
        return asyncio.run(call_llm_async(
            prompt, system_prompt, output_schema, tools
        ))
