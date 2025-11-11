from langsmith import Client
from dexter.evals.data.loader import DataLoader
from pathlib import Path


def create_dataset_from_csv(csv_path: Path, dataset_name: str):
    """
    Create a LangSmith dataset from the CSV file.
    
    Args:
        csv_path: Path to the CSV file
        dataset_name: Name for the dataset
    
    Returns:
        str: The dataset name
    """
    loader = DataLoader(csv_path)
    data = loader.load()
    
    # Check if dataset already exists
    try:
        client = Client()
        existing_dataset = client.read_dataset(dataset_name=dataset_name)
        if existing_dataset:
            print(f"Dataset '{dataset_name}' already exists. Using existing dataset.")
            return existing_dataset.name
    except Exception:
        print(f"Dataset '{dataset_name}' does not exist. Creating new dataset.")
    
    # Create examples from CSV data
    examples = []
    for row in data:
        example = {
            "inputs": {
                "question": row["Question"]
            },
            "outputs": {
                "answer": row["Answer"]
            },
            "metadata": {
                "question_type": row.get("Question Type", ""),
                "expert_time_mins": row.get("Expert time (mins)", ""),
                "rubric": row.get("Rubric", "")
            }
        }
        examples.append(example)


    # Keep only the first 3 examples for testing
    examples = examples[:3]
    
    # Create the dataset
    dataset = client.create_dataset(
        dataset_name=dataset_name,
        description="Finance agent evaluation dataset from vals-finance-agent-50.csv"
    )
    
    # Add examples to the dataset
    client.create_examples(
        inputs=[ex["inputs"] for ex in examples],
        outputs=[ex["outputs"] for ex in examples],
        dataset_id=dataset.id,
        metadata=[ex["metadata"] for ex in examples]
    )
    
    print(f"Created dataset '{dataset_name}' with {len(examples)} examples.")
    return dataset_name

