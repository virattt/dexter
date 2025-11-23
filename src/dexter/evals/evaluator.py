from langsmith import Client
from dexter.agent import Agent
from typing import Callable, List, cast
from pathlib import Path
from pydantic import BaseModel, Field
from dexter.model import get_chat_model, DEFAULT_MODEL
from dexter.evals.prompts import CORRECTNESS_PROMPT
from datetime import datetime


def get_today_str() -> str:
    """Returns the current date in a readable format."""
    return datetime.now().strftime("%A, %B %d, %Y")


eval_model = get_chat_model(
    model_name=DEFAULT_MODEL,
)


class CorrectnessScore(BaseModel):
    """Score the answer correctness against the reference answer."""
    reasoning: str = Field(description="The reason for the score, including specific examples comparing the agent's answer to the reference answer.")
    score: int = Field(description="Integer score 1-5 showing how well the agent's answer matches the reference answer in terms of correctness (1 = largely incorrect, 5 = all key facts correct).")


def eval_correctness(inputs: dict, outputs: dict, reference_outputs: dict):
    """
    Evaluate the correctness of the agent's answer compared to the reference answer.
    
    Args:
        inputs: Dictionary containing the user query/question
        outputs: Dictionary containing the agent's answer (key: "answer")
        reference_outputs: Dictionary containing the reference answer (key: "answer")
    
    Returns:
        Dictionary with correctness score and reasoning
    """
    query = inputs.get("question", "") or inputs.get("query", "")
    agent_answer = outputs.get("answer", "")
    reference_answer = reference_outputs.get("answer", "")
    
    user_input_content = CORRECTNESS_PROMPT.format(
        user_question=query,
        agent_answer=agent_answer,
        reference_answer=reference_answer,
        today=get_today_str()
    )
    
    eval_result = cast(
        CorrectnessScore,
        eval_model.with_structured_output(CorrectnessScore).invoke([
            {"role": "user", "content": user_input_content}
        ])
    )
    
    return {
        "key": "correctness_score",
        "score": eval_result.score / 5,  # Normalize to 0-1
        "comment": eval_result.reasoning
    }


def create_target_function():
    """
    Create a target function that runs the agent on a given input.
    
    Returns:
        Callable: Target function that takes inputs dict and returns outputs dict
    """
    def target(inputs: dict):
        """
        Target function that runs the agent on a given input.
        
        Args:
            inputs: Dictionary containing the question/query
            
        Returns:
            Dictionary containing the agent's answer
        """
        agent = Agent()
        question = inputs.get("question", "")
        answer = agent.run(question)
        
        return {
            "answer": answer
        }
    
    return target


def run_evaluation(
    dataset_name: str,
    evaluators: List[Callable],
    experiment_prefix: str = "Dexter Finance Agent Eval",
    max_concurrency: int = 5,
    metadata: dict = None,
    client: Client = None
):
    """
    Run evaluations on a LangSmith dataset.
    
    Args:
        dataset_name: Name of the dataset to evaluate against
        evaluators: List of evaluator functions
        experiment_prefix: Prefix for the experiment name
        max_concurrency: Maximum number of concurrent evaluations
        metadata: Optional metadata to attach to the evaluation run
        client: Optional LangSmith client (creates new one if not provided)
    
    Returns:
        Evaluation results
    """
    if client is None:
        client = Client()
    
    if metadata is None:
        metadata = {}
    
    target = create_target_function()
    
    return client.evaluate(
        target,
        data=dataset_name,
        evaluators=evaluators,
        experiment_prefix=experiment_prefix,
        max_concurrency=max_concurrency,
        metadata=metadata
    )

