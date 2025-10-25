import os
import time
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel
from typing import Type, List, Optional
from langchain_core.tools import BaseTool
from langchain_core.messages import AIMessage
from openai import APIConnectionError

from dexter.prompts import DEFAULT_SYSTEM_PROMPT
from pathlib import Path

# Load environment variables from multiple possible locations
# 1. Current directory
# 2. Home directory (~/.dexter/.env)
# 3. Original installation directory
env_locations = [
    Path.cwd() / ".env",
    Path.home() / ".dexter" / ".env",
    Path("/Users/giannisan/dexter/.env")
]

for env_path in env_locations:
    if env_path.exists():
        load_dotenv(env_path)
        break
else:
    # If no .env file found, just load from environment
    load_dotenv()

# Initialize the OpenAI client
# Make sure your OPENAI_API_KEY is set in your .env
# Optionally set OPENAI_BASE_URL for custom OpenAI-compatible APIs
llm = ChatOpenAI(
    model=os.getenv("OPENAI_MODEL", "gpt-4.1"),
    temperature=0,
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url=os.getenv("OPENAI_BASE_URL")
)

def call_llm(
    prompt: str,
    system_prompt: Optional[str] = None,
    output_schema: Optional[Type[BaseModel]] = None,
    tools: Optional[List[BaseTool]] = None,
) -> AIMessage:
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
          return chain.invoke({"prompt": prompt})
      except APIConnectionError as e:
          if attempt == 2:  # Last attempt
              raise
          time.sleep(0.5 * (2 ** attempt))  # 0.5s, 1s backoff
