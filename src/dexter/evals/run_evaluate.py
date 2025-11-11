from dotenv import load_dotenv
from langsmith import Client
from dexter.evals.dataset import create_dataset_from_csv
from dexter.evals.evaluator import run_evaluation, eval_correctness
from pathlib import Path

load_dotenv()



def main():
    """
    Main function to run evaluations.
    """
    # Define evaluators
    evaluators = [eval_correctness]

    # Get the CSV path relative to this file's location
    csv_path = Path(__file__).parent / "data" / "vals-finance-agent-50.csv"

    # Define dataset name
    dataset_name = "Finance Agent Eval Dataset Test"

    # Create dataset from CSV in LangSmith
    dataset_name = create_dataset_from_csv(csv_path=csv_path, dataset_name=dataset_name)
    
    # Run evaluations
    return run_evaluation(
        dataset_name=dataset_name,
        evaluators=evaluators,
        experiment_prefix="Dexter Finance Agent Eval",
        max_concurrency=5,
        metadata={
            "csv_source": str(csv_path),
            "evaluator": "correctness"
        },
        client=Client()
    )


if __name__ == "__main__":
    results = main()
    print(results)

