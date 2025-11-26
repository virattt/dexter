import json
import hashlib
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path
from pydantic import BaseModel

from dexter.model import call_llm, DEFAULT_MODEL
from dexter.prompts import DEFAULT_SYSTEM_PROMPT, CONTEXT_SELECTION_SYSTEM_PROMPT


class ContextManager:
    """Manages context offloading and onloading for tool outputs."""
    
    def __init__(self, context_dir: str = ".dexter/context", model: str = DEFAULT_MODEL):
        """
        Initialize the context manager.
        
        Args:
            context_dir: Directory path for storing context files
            model: The model to use for LLM calls
        """
        self.context_dir = Path(context_dir)
        self.context_dir.mkdir(parents=True, exist_ok=True)
        self.pointers: List[Dict[str, Any]] = []
        self.model = model
    
    def _hash_args(self, args: dict) -> str:
        """Generate a hash of tool arguments for filename."""
        # Sort args to ensure consistent hashing
        args_str = json.dumps(args, sort_keys=True, default=self._json_serializer)
        return hashlib.md5(args_str.encode()).hexdigest()[:12]
    
    def _json_serializer(self, obj):
        """Custom JSON serializer for Pydantic models and other special types."""
        if isinstance(obj, BaseModel):
            # Use model_dump() for Pydantic v2, fallback to dict() for v1
            if hasattr(obj, 'model_dump'):
                return obj.model_dump()
            elif hasattr(obj, 'dict'):
                return obj.dict()
            else:
                return str(obj)
        elif isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, (list, tuple)):
            return [self._json_serializer(item) for item in obj]
        elif isinstance(obj, dict):
            return {k: self._json_serializer(v) for k, v in obj.items()}
        # Let JSON handle primitive types (str, int, float, bool, None)
        return obj
    
    def _generate_summary(self, tool_name: str, args: dict, result: Any) -> str:
        """Generate a brief summary snippet of the tool output using LLM."""
        # Convert result to string representation for the prompt
        result_str = json.dumps(result, default=str)[:1000]  # Limit size for prompt
        
        prompt = f"""
        Tool: {tool_name}
        Arguments: {json.dumps(args, indent=2)}
        Output preview: {result_str}
        
        Generate a brief one-sentence summary describing what data this tool output contains.
        Focus on the key information (e.g., "Apple's last 4 quarterly income statements from Q1 2023 to Q4 2023").
        """
        
        try:
            response = call_llm(
                prompt,
                system_prompt=DEFAULT_SYSTEM_PROMPT,
                model=self.model
            )
            summary = response.content if hasattr(response, 'content') else str(response)
            return summary.strip()
        except Exception as e:
            # Fallback to a simple description if LLM fails
            return f"{tool_name} output with args {args}"
    
    def save_context(
        self,
        tool_name: str,
        args: dict,
        result: Any,
        task_id: Optional[int] = None
    ) -> str:
        """
        Save tool output to a JSON file and return the file path.
        
        Args:
            tool_name: Name of the tool
            args: Tool arguments used
            result: Tool output result
            task_id: Optional task ID associated with this output
            
        Returns:
            File path to the saved context
        """
        # Generate filename
        args_hash = self._hash_args(args)
        filename = f"{tool_name}_{args_hash}.json"
        filepath = self.context_dir / filename
        
        # Generate summary
        summary = self._generate_summary(tool_name, args, result)
        
        # Prepare context data (metadata first, result last)
        context_data = {
            "tool_name": tool_name,
            "args": args,
            "summary": summary,
            "timestamp": datetime.now().isoformat(),
            "task_id": task_id,
            "result": result
        }
        
        # Save to file with custom serializer for Pydantic models
        with open(filepath, 'w') as f:
            json.dump(context_data, f, default=self._json_serializer, indent=2)
        
        # Create pointer metadata
        pointer = {
            "filepath": str(filepath),
            "filename": filename,
            "tool_name": tool_name,
            "args": args,
            "summary": summary,
            "task_id": task_id
        }
        
        self.pointers.append(pointer)
        
        return str(filepath)
    
    def get_all_pointers(self) -> List[Dict[str, Any]]:
        """Return all tracked pointer metadata."""
        return self.pointers.copy()
    
    def load_contexts(self, filepaths: List[str]) -> List[Dict[str, Any]]:
        """
        Load context files and return their data.
        
        Args:
            filepaths: List of file paths to load
            
        Returns:
            List of context data dictionaries
        """
        contexts = []
        for filepath in filepaths:
            try:
                with open(filepath, 'r') as f:
                    context_data = json.load(f)
                    contexts.append(context_data)
            except Exception as e:
                # Log error but continue loading other files
                print(f"Warning: Failed to load context file {filepath}: {e}")
        
        return contexts
    
    def select_relevant_contexts(
        self,
        query: str,
        available_pointers: List[Dict[str, Any]]
    ) -> List[str]:
        """
        Use LLM to select which context files are relevant for answering the query.
        
        Args:
            query: Original user query
            available_pointers: List of pointer metadata dictionaries
            
        Returns:
            List of selected file paths
        """
        if not available_pointers:
            return []
        
        # Format pointers for the prompt
        pointers_info = []
        for i, ptr in enumerate(available_pointers):
            pointers_info.append({
                "id": i,
                "tool_name": ptr["tool_name"],
                "args": ptr["args"],
                "summary": ptr["summary"]
            })
        
        prompt = f"""
        Original user query: "{query}"
        
        Available tool outputs:
        {json.dumps(pointers_info, indent=2, default=self._json_serializer)}
        
        Select which tool outputs are relevant for answering the query.
        Return a JSON object with a "context_ids" field containing a list of IDs (0-indexed) of the relevant outputs.
        Only select outputs that contain data directly relevant to answering the query.
        """
        
        from dexter.schemas import SelectedContexts
        
        try:
            response = call_llm(
                prompt,
                system_prompt=CONTEXT_SELECTION_SYSTEM_PROMPT,
                output_schema=SelectedContexts,
                model=self.model
            )
            
            # Extract selected IDs
            if isinstance(response, SelectedContexts):
                selected_ids = response.context_ids
            elif hasattr(response, 'context_ids'):
                selected_ids = response.context_ids
            else:
                # Fallback: return all if selection fails
                selected_ids = list(range(len(available_pointers)))
            
            # Map IDs to filepaths
            selected_filepaths = []
            for idx in selected_ids:
                if 0 <= idx < len(available_pointers):
                    selected_filepaths.append(available_pointers[idx]["filepath"])
            
            return selected_filepaths
        except Exception as e:
            # Fallback: return all contexts if selection fails
            print(f"Warning: Context selection failed: {e}, loading all contexts")
            return [ptr["filepath"] for ptr in available_pointers]

