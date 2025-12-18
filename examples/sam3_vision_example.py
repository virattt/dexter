#!/usr/bin/env python3
"""
SAM 3 Vision Analysis Example for Dexter.

This example demonstrates how to use SAM 3 (Segment Anything Model 3) 
capabilities integrated into Dexter for:
- Image segmentation with natural language queries
- Video object tracking
- Interactive vision analysis

Requirements:
    pip install pillow numpy torch opencv-python
    pip install sam3  # Meta AI's SAM 3 package (when available)
    
For API mode (without local model):
    Set SAM3_API_ENDPOINT environment variable
"""

import os
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from dexter.tools.sam3 import (
    Sam3ImageProcessor,
    Sam3VideoProcessor,
    Sam3Agent,
    segment_image,
    segment_video,
    run_segmentation_query
)


def demo_image_segmentation():
    """Demonstrate image segmentation with natural language."""
    print("\n" + "="*60)
    print("📸 Image Segmentation Demo")
    print("="*60)
    
    # Initialize processor
    processor = Sam3ImageProcessor(
        confidence_threshold=0.5,
        device="auto"  # Will use CUDA if available
    )
    
    # Example with text query (requires SAM 3 model or API)
    print("\n1. Text-based Segmentation:")
    print("   Query: 'Find all the cars in the image'")
    
    # Note: This requires an actual image file
    # result = processor.segment_with_text(
    #     image="path/to/image.jpg",
    #     query="cars"
    # )
    # print(f"   Found: {len(result.masks)} objects")
    # print(f"   Scores: {result.scores}")
    
    print("   [Requires image file - see usage below]")
    
    # Point-based segmentation
    print("\n2. Point-based Segmentation:")
    print("   Points: [(100, 200), (150, 250)]")
    print("   Labels: [1, 1] (foreground)")
    
    # Bounding box segmentation  
    print("\n3. Box-based Segmentation:")
    print("   Box: (50, 50, 300, 300)")
    
    print("""
Usage Example:
    from dexter.tools.sam3 import segment_image
    
    # Quick segmentation
    result = segment_image("photo.jpg", "find all people")
    print(f"Found {len(result.masks)} people")
    
    # With visualization
    processor = Sam3ImageProcessor()
    result = processor.segment_with_text(
        image="photo.jpg",
        query="red cars",
        return_visualization=True
    )
    
    # Save visualization
    if 'visualization' in result.metadata:
        result.metadata['visualization'].save("segmented.png")
    """)


def demo_video_tracking():
    """Demonstrate video object tracking."""
    print("\n" + "="*60)
    print("🎬 Video Object Tracking Demo")
    print("="*60)
    
    # Initialize processor
    processor = Sam3VideoProcessor(
        confidence_threshold=0.5,
        device="auto"
    )
    
    print("\n1. Natural Language Video Tracking:")
    print("   Query: 'Track the red ball'")
    
    print("""
Usage Example:
    from dexter.tools.sam3 import segment_video
    
    # Track objects in video
    result = segment_video(
        video_path="video.mp4",
        query="track the person in blue",
        output_dir="./tracking_output",
        max_frames=300
    )
    
    # Print tracking results
    print(f"Total frames: {result.total_frames}")
    print(f"Objects tracked: {len(result.tracked_objects)}")
    
    for obj in result.tracked_objects:
        print(f"  - {obj.label}: visible in {obj.frame_count} frames")
        print(f"    Average confidence: {obj.average_score:.2%}")
    """)
    
    print("\n2. Point-initialized Tracking:")
    print("   Initial points on first frame to track object")
    
    print("""
Usage Example:
    processor = Sam3VideoProcessor()
    
    result = processor.track_with_points(
        video_path="video.mp4",
        initial_points=[(150, 200), (160, 210)],  # Points on object
        point_labels=[1, 1],  # 1 = foreground
        object_label="person",
        output_dir="./point_tracking"
    )
    """)


def demo_sam3_agent():
    """Demonstrate the SAM 3 Agent for complex queries."""
    print("\n" + "="*60)
    print("🤖 SAM 3 Agent Demo")
    print("="*60)
    
    print("""
The SAM 3 Agent combines an LLM with SAM 3 vision capabilities
to understand and execute complex natural language queries.

Supported Query Types:
  - "Find all the cars" → segment_object
  - "How many people are there?" → count_objects  
  - "Where is the dog?" → locate_object
  - "Track the ball in the video" → track_object
  - "Describe what's in this image" → describe_scene

Usage Example:
    from dexter.tools.sam3 import Sam3Agent
    
    # Initialize agent
    agent = Sam3Agent(
        llm_api_key=os.getenv("OPENAI_API_KEY"),  # For query interpretation
        confidence_threshold=0.5
    )
    
    # Simple query
    response = agent.query(
        "Find all the people wearing hats",
        image="crowd.jpg"
    )
    
    print(f"Action: {response.action}")
    print(f"Interpretation: {response.interpretation}")
    print(f"Result: {response.explanation}")
    print(f"Confidence: {response.confidence:.1%}")
    
    # Video query
    response = agent.query(
        "Track the white car through the intersection",
        video="traffic.mp4"
    )
    
    # Batch queries
    responses = agent.batch_query(
        queries=[
            "How many cars are there?",
            "Where are the pedestrians?",
            "Find all traffic lights"
        ],
        image="intersection.jpg"
    )
    """)
    
    # Without API key, simple interpretation
    print("\n--- Simple interpretation demo (no API key required) ---")
    
    agent = Sam3Agent(llm_api_key=None)  # Will use simple pattern matching
    
    test_queries = [
        "Find all the cars",
        "How many people are in the image?",
        "Where is the cat?",
        "Track the ball movement",
        "Describe the scene"
    ]
    
    for query in test_queries:
        interpretation = agent._simple_interpret(query)
        print(f"\n  Query: '{query}'")
        print(f"  → Action: {interpretation['action']}")
        print(f"  → Target: {interpretation['target']}")


def demo_convenience_function():
    """Show the quick convenience function."""
    print("\n" + "="*60)
    print("⚡ Quick Functions")
    print("="*60)
    
    print("""
For quick one-off operations, use convenience functions:

    from dexter.tools.sam3 import (
        segment_image,
        segment_video, 
        run_segmentation_query
    )
    
    # Quick image segmentation
    result = segment_image("photo.jpg", "all cars", confidence=0.6)
    
    # Quick video tracking
    result = segment_video("video.mp4", "the person in red")
    
    # Quick agent query
    response = run_segmentation_query(
        "Count all the birds",
        image="park.jpg"
    )
    print(response.explanation)
    """)


def demo_interactive_session():
    """Show interactive session usage."""
    print("\n" + "="*60)
    print("💬 Interactive Session")
    print("="*60)
    
    print("""
Start an interactive query session:

    from dexter.tools.sam3 import Sam3Agent
    
    agent = Sam3Agent()
    
    # Start interactive mode
    agent.interactive_session(image="photo.jpg")
    
    # Or with video
    agent.interactive_session(video="video.mp4")
    
Interactive Commands:
  - Type natural language queries
  - "help" - Show available commands
  - "quit" - Exit session
  
Example Session:
    🤖 SAM 3 Agent Interactive Session
    Type 'quit' to exit, 'help' for commands
    ----------------------------------------
    Media loaded: image
    
    🔍 Query: find all the people
    📊 Action: segment_object
    💭 Interpretation: Looking for: people
    📝 Result: Successfully segmented 5 instance(s) of 'people' with 87% confidence.
    🎯 Confidence: 70%
    
    🔍 Query: how many cars
    ...
    """)


def main():
    """Run all demonstrations."""
    print("╔" + "═"*58 + "╗")
    print("║" + " SAM 3 Vision Capabilities for Dexter ".center(58) + "║")
    print("║" + " Meta AI Segment Anything Model 3 Integration ".center(58) + "║")
    print("╚" + "═"*58 + "╝")
    
    print("""
This module provides Dexter with advanced vision capabilities:

🔍 Image Segmentation
   - Natural language object detection
   - Point-based segmentation
   - Bounding box segmentation

🎬 Video Analysis
   - Object tracking across frames
   - Multi-object tracking
   - Motion analysis

🤖 AI Agent Interface
   - Complex query understanding
   - Automatic action selection
   - Natural language explanations

Setup Options:
1. Local Model (requires GPU):
   - Install: pip install torch sam3
   - Download model weights
   
2. API Mode (cloud):
   - Set SAM3_API_ENDPOINT in .env
   - No local GPU required
    """)
    
    demo_image_segmentation()
    demo_video_tracking()
    demo_sam3_agent()
    demo_convenience_function()
    demo_interactive_session()
    
    print("\n" + "="*60)
    print("✅ Demo Complete!")
    print("="*60)
    print("""
Next Steps:
1. Install dependencies: pip install pillow numpy torch opencv-python
2. Install SAM 3: pip install sam3 (when available)
3. Or set SAM3_API_ENDPOINT for cloud mode
4. Run with an actual image: python sam3_vision_example.py --image photo.jpg
    """)


if __name__ == "__main__":
    main()
