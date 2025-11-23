import os
import time
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import ChatPromptTemplate
from pydantic import BaseModel
from typing import Type, List, Optional, Iterator, Any
from langchain_core.tools import BaseTool
from langchain_core.messages import AIMessage
from langchain_core.language_models.chat_models import BaseChatModel

from dexter.prompts import DEFAULT_SYSTEM_PROMPT

# Update this to the model you want to use
DEFAULT_MODEL = "gpt-5.1"

def get_chat_model(
    model_name: str = DEFAULT_MODEL,
    temperature: float = 0,
    streaming: bool = False
) -> BaseChatModel:
    """
    Factory function to get the appropriate chat model based on the model name.
    """
    if model_name.startswith("claude-"):
        # Anthropic models
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not found in environment variables")
        
        return ChatAnthropic(
            model=model_name,
            temperature=temperature,
            api_key=api_key,
            streaming=streaming
        )
    
    elif model_name.startswith("gemini-"):
        # Google Gemini models
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY not found in environment variables")
            
        return ChatGoogleGenerativeAI(
            model=model_name,
            temperature=temperature,
            google_api_key=api_key,
            streaming=streaming,
            convert_system_message_to_human=True 
        )
        
    else:
        # Default to OpenAI (gpt-* or others)
        # OpenAI client handles reading OPENAI_API_KEY from env automatically if not passed,
        # but we pass it explicitly to match existing pattern if set.
        api_key = os.getenv("OPENAI_API_KEY")
        return ChatOpenAI(
            model=model_name, 
            temperature=temperature, 
            api_key=api_key, 
            streaming=streaming
        )


def call_llm(
    prompt: str,
    model: str = DEFAULT_MODEL,
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
  llm = get_chat_model(model_name=model, temperature=0, streaming=False)

  # Add structured output or tools to the LLM.
  runnable = llm
  if output_schema:
      runnable = llm.with_structured_output(output_schema, method="function_calling")
  elif tools:
      runnable = llm.bind_tools(tools)
  
  chain = prompt_template | runnable
  
  # Retry logic for transient connection errors
  # Broadening exception handling for multiple providers
  for attempt in range(3):
      try:
          return chain.invoke({"prompt": prompt})
      except Exception as e:
          # We only want to retry on connection/transient errors, but catching generic Exception 
          # for simplicity across providers as they raise different errors.
          # In production, we should catch specific errors from each provider.
          if attempt == 2:  # Last attempt
              raise e
          time.sleep(0.5 * (2 ** attempt))  # 0.5s, 1s backoff


def call_llm_stream(
    prompt: str,
    model: str = DEFAULT_MODEL,
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
    llm = get_chat_model(model_name=model, temperature=0, streaming=True)
    
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
        except Exception as e:
            if attempt == 2:  # Last attempt
                raise e
            time.sleep(0.5 * (2 ** attempt))  # 0.5s, 1s backoff
