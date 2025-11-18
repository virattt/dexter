import os
import time
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from pydantic import BaseModel
from typing import Type, List, Optional, Iterator
from langchain_core.tools import BaseTool
from langchain_core.messages import AIMessage
from openai import APIConnectionError

from dexter.prompts import DEFAULT_SYSTEM_PROMPT

# Initialize the OpenAI client
# Make sure your OPENAI_API_KEY is set in your .env
def call_llm(
    prompt: str,
    model: str = "gpt-4.1",
    system_prompt: Optional[str] = None,
    output_schema: Optional[Type[BaseModel]] = None,
    tools: Optional[List[BaseTool]] = None,
) -> AIMessage:
  final_system_prompt = system_prompt if system_prompt else DEFAULT_SYSTEM_PROMPT
  
  prompt_template = ChatPromptTemplate.from_messages([
      ("system", final_system_prompt),
      ("user", "{prompt}")
  ])

  # Initialize the LLM.
  llm = ChatOpenAI(model=model, temperature=0, api_key=os.getenv("OPENAI_API_KEY"))

  # Add structured output or tools to the LLM.
  runnable = llm
  if output_schema:
      runnable = llm.with_structured_output(output_schema, method="function_calling")
  elif tools:
      runnable = llm.bind_tools(tools)
  
  chain = prompt_template | runnable
  
  # Retry logic for transient connection errors
  for attempt in range(3):
      try:
          return chain.invoke({"prompt": prompt})
      except APIConnectionError as e:
          if attempt == 2:  # Last attempt
              raise
          time.sleep(0.5 * (2 ** attempt))  # 0.5s, 1s backoff


def call_llm_stream(
    prompt: str,
    model: str = "gpt-4.1",
    system_prompt: Optional[str] = None,
) -> Iterator[str]:
    """
    Stream LLM responses as text chunks.
    
    Note: Streaming does not support structured output or tools.
    Use this when you want to display text incrementally.
    """
    final_system_prompt = system_prompt if system_prompt else DEFAULT_SYSTEM_PROMPT
    
    prompt_template = ChatPromptTemplate.from_messages([
        ("system", final_system_prompt),
        ("user", "{prompt}")
    ])
    
    # Initialize the LLM with streaming enabled
    llm = ChatOpenAI(model=model, temperature=0, api_key=os.getenv("OPENAI_API_KEY"), streaming=True)
    
    chain = prompt_template | llm
    
    # Retry logic for transient connection errors
    for attempt in range(3):
        try:
            for chunk in chain.stream({"prompt": prompt}):
                # LangChain streams AIMessage chunks, extract content
                if hasattr(chunk, 'content'):
                    content = chunk.content
                    if content:  # Only yield non-empty content
                        yield content
            break
        except APIConnectionError as e:
            if attempt == 2:  # Last attempt
                raise
            time.sleep(0.5 * (2 ** attempt))  # 0.5s, 1s backoff
