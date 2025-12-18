# SAM 3 Vision Integration for Dexter

Meta AI's **Segment Anything Model 3 (SAM 3)** integration provides Dexter with advanced computer vision capabilities for image and video analysis.

## Overview

SAM 3 enables Dexter to:
- 🔍 **Image Segmentation**: Identify and segment objects using natural language
- 🎬 **Video Tracking**: Track objects across video frames
- 🤖 **Vision Agent**: Answer complex visual questions with AI

## Quick Start

### Installation

```bash
# Core dependencies
pip install pillow numpy torch opencv-python

# SAM 3 package (when available from Meta)
pip install sam3

# Or use API mode - set in .env:
# SAM3_API_ENDPOINT=https://your-sam3-api.com
```

### Basic Usage

```python
from dexter.tools.sam3 import segment_image, segment_video, Sam3Agent

# Quick image segmentation
result = segment_image("photo.jpg", "find all the cars")
print(f"Found {len(result.masks)} cars")

# Video tracking
result = segment_video("video.mp4", "track the person in red")
print(f"Tracked across {result.total_frames} frames")

# AI Agent for complex queries
agent = Sam3Agent()
response = agent.query("How many people are wearing hats?", image="crowd.jpg")
print(response.explanation)
```

## Components

### 1. Sam3ImageProcessor

Handles image segmentation with multiple input methods:

```python
from dexter.tools.sam3 import Sam3ImageProcessor

processor = Sam3ImageProcessor(
    confidence_threshold=0.5,
    device="auto"  # cuda, mps, or cpu
)

# Text-based segmentation
result = processor.segment_with_text(
    image="photo.jpg",
    query="red cars",
    return_visualization=True
)

# Point-based segmentation
result = processor.segment_with_points(
    image="photo.jpg",
    points=[(150, 200), (160, 210)],
    labels=[1, 1]  # 1=foreground, 0=background
)

# Box-based segmentation
result = processor.segment_with_box(
    image="photo.jpg",
    box=(50, 50, 300, 300)  # x1, y1, x2, y2
)
```

#### SegmentationResult

```python
@dataclass
class SegmentationResult:
    masks: List[np.ndarray]      # Binary segmentation masks
    scores: List[float]          # Confidence scores
    labels: List[str]            # Object labels
    boxes: List[Tuple[int,int,int,int]]  # Bounding boxes
    metadata: Dict[str, Any]     # Additional info
```

### 2. Sam3VideoProcessor

Handles video object tracking:

```python
from dexter.tools.sam3 import Sam3VideoProcessor

processor = Sam3VideoProcessor(
    confidence_threshold=0.5,
    device="auto"
)

# Natural language tracking
result = processor.segment_video(
    video_path="video.mp4",
    query="the moving car",
    max_frames=300,
    output_dir="./output",
    save_visualizations=True
)

# Point-initialized tracking
result = processor.track_with_points(
    video_path="video.mp4",
    initial_points=[(150, 200)],
    point_labels=[1],
    object_label="person"
)

# Access results
for obj in result.tracked_objects:
    print(f"{obj.label}: {obj.frame_count} frames, {obj.average_score:.1%} confidence")
```

#### VideoSegmentationResult

```python
@dataclass
class VideoSegmentationResult:
    tracked_objects: List[TrackedObject]
    total_frames: int
    fps: float
    resolution: Tuple[int, int]
    metadata: Dict[str, Any]
```

### 3. Sam3Agent (MLLM Vision Agent)

AI agent that interprets natural language and uses SAM 3:

```python
from dexter.tools.sam3 import Sam3Agent

agent = Sam3Agent(
    llm_api_key=os.getenv("OPENAI_API_KEY"),  # Optional
    confidence_threshold=0.5
)

# Complex queries
response = agent.query(
    "Find everyone wearing a red shirt and count them",
    image="crowd.jpg"
)

print(f"Action: {response.action}")
print(f"Interpretation: {response.interpretation}")
print(f"Result: {response.explanation}")

# Supported actions:
# - segment_object: Find and segment objects
# - count_objects: Count instances
# - locate_object: Find object locations
# - track_object: Track in video
# - describe_scene: Describe image contents
```

#### Interactive Session

```python
agent = Sam3Agent()
agent.interactive_session(image="photo.jpg")

# Interactive mode:
# 🔍 Query: find all the people
# 📊 Action: segment_object
# 💭 Interpretation: Looking for: people
# 📝 Result: Found 5 people with 87% confidence
```

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# SAM 3 API (for cloud mode without local model)
SAM3_API_ENDPOINT=https://your-sam3-service.com
SAM3_VIDEO_API_ENDPOINT=https://your-sam3-video-service.com

# Optional: OpenAI for agent query interpretation
OPENAI_API_KEY=sk-...
```

### Local Model Setup

```python
from dexter.tools.sam3 import Sam3ImageProcessor

processor = Sam3ImageProcessor(
    model_path="/path/to/sam3_weights.pth",
    bpe_path="/path/to/bpe.model",
    device="cuda"
)

# Initialize will load the model
processor.initialize_local()
```

## Use Cases

### Financial Document Analysis

```python
# Analyze charts and graphs
agent = Sam3Agent()
response = agent.query(
    "Find and highlight all the candlestick patterns",
    image="trading_chart.png"
)
```

### NFT/Digital Asset Analysis

```python
# Analyze NFT artwork
response = agent.query(
    "Identify all unique elements in this NFT",
    image="nft_artwork.jpg"
)
```

### Transaction Verification

```python
# Verify physical receipts
response = agent.query(
    "Find and extract the total amount",
    image="receipt.jpg"
)
```

### Video Surveillance

```python
# Track wallet holders
result = segment_video(
    "surveillance.mp4",
    "track all people carrying bags"
)
```

## Integration with Dark Dexter

SAM 3 is available in Dark Dexter for visual analysis tasks:

```python
# In dark_dexter.py autonomous agent
from dexter.tools.sam3 import Sam3Agent

# Add vision capability
vision_agent = Sam3Agent()

# Analyze market charts
response = vision_agent.query(
    "Identify support and resistance levels",
    image="chart.png"
)
```

## API Reference

### segment_image()

```python
def segment_image(
    image: Union[str, Image, np.ndarray],
    query: str,
    api_endpoint: Optional[str] = None,
    confidence: float = 0.5
) -> SegmentationResult
```

### segment_video()

```python
def segment_video(
    video_path: str,
    query: str,
    output_dir: Optional[str] = None,
    max_frames: Optional[int] = None
) -> VideoSegmentationResult
```

### run_segmentation_query()

```python
def run_segmentation_query(
    query: str,
    image: Optional[Union[str, Image]] = None,
    video: Optional[str] = None,
    api_key: Optional[str] = None
) -> AgentResponse
```

## Performance Tips

1. **GPU Acceleration**: Use CUDA or MPS for faster processing
2. **Frame Limiting**: Set `max_frames` for long videos
3. **Confidence Threshold**: Adjust to filter weak detections
4. **API Mode**: Use for quick prototyping without local model

## Troubleshooting

### Model Not Found

```
⚠️ SAM 3 not installed. Install with: pip install sam3
```

Solution: Install the SAM 3 package or use API mode.

### Out of Memory

```
❌ CUDA out of memory
```

Solution: Reduce image size, use CPU, or use API mode.

### No Detections

```
I couldn't find any 'object' in the image
```

Solution: Try different queries, lower confidence threshold, or check image quality.

## Resources

- [SAM 3 Paper](https://ai.meta.com/sam3) (Once released)
- [Segment Anything Demo](https://segment-anything.com)
- [Dexter Documentation](./DARK_DEXTER.md)
