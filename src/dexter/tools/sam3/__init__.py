"""
SAM 3 (Segment Anything Model 3) Vision and Video Analysis Tools for Dexter.

This module provides integration with Meta AI's SAM 3 for:
- Image segmentation with natural language queries
- Video object tracking and segmentation
- Multi-modal AI agent capabilities
"""

from .image_processor import Sam3ImageProcessor, segment_image
from .video_processor import Sam3VideoProcessor, segment_video
from .agent import Sam3Agent, run_segmentation_query

__all__ = [
    "Sam3ImageProcessor",
    "Sam3VideoProcessor", 
    "Sam3Agent",
    "segment_image",
    "segment_video",
    "run_segmentation_query",
]
