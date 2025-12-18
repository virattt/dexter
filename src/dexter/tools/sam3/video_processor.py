"""
SAM 3 Video Segmentation and Tracking Processor.

Provides video object segmentation and tracking using Meta AI's SAM 3 model.
Supports tracking objects across video frames with natural language queries.
"""

import os
import tempfile
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple, Union, Generator
from dataclasses import dataclass, field
import json

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False
    Image = None

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False
    np = None

try:
    import torch
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False

try:
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False


@dataclass 
class TrackedObject:
    """Represents a tracked object across video frames."""
    object_id: int
    label: str
    track_history: List[Dict[str, Any]] = field(default_factory=list)
    
    def add_detection(
        self,
        frame_idx: int,
        mask: Any,
        box: Tuple[int, int, int, int],
        score: float
    ):
        """Add a detection to the track history."""
        self.track_history.append({
            'frame_idx': frame_idx,
            'mask': mask,
            'box': box,
            'score': score
        })
    
    @property
    def frame_count(self) -> int:
        return len(self.track_history)
    
    @property
    def average_score(self) -> float:
        if not self.track_history:
            return 0.0
        return sum(d['score'] for d in self.track_history) / len(self.track_history)


@dataclass
class VideoSegmentationResult:
    """Result of video segmentation operation."""
    tracked_objects: List[TrackedObject]
    total_frames: int
    fps: float
    resolution: Tuple[int, int]
    metadata: Dict[str, Any]
    
    def get_frame_masks(self, frame_idx: int) -> List[Dict[str, Any]]:
        """Get all masks for a specific frame."""
        masks = []
        for obj in self.tracked_objects:
            for detection in obj.track_history:
                if detection['frame_idx'] == frame_idx:
                    masks.append({
                        'object_id': obj.object_id,
                        'label': obj.label,
                        'mask': detection['mask'],
                        'box': detection['box'],
                        'score': detection['score']
                    })
        return masks
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert result to dictionary."""
        return {
            'total_frames': self.total_frames,
            'fps': self.fps,
            'resolution': self.resolution,
            'tracked_objects': [
                {
                    'object_id': obj.object_id,
                    'label': obj.label,
                    'frame_count': obj.frame_count,
                    'average_score': obj.average_score
                }
                for obj in self.tracked_objects
            ],
            'metadata': self.metadata
        }


class Sam3VideoProcessor:
    """
    SAM 3 Video Processor for object tracking and segmentation.
    
    Uses SAM 3's video prediction capabilities for:
    - Object tracking across frames
    - Video object segmentation
    - Multi-object tracking with natural language
    """
    
    def __init__(
        self,
        model_path: Optional[str] = None,
        api_endpoint: Optional[str] = None,
        device: str = "auto",
        confidence_threshold: float = 0.5
    ):
        """
        Initialize SAM 3 Video Processor.
        
        Args:
            model_path: Path to SAM 3 video model weights
            api_endpoint: URL for remote SAM 3 video API
            device: Device to use ('cuda', 'cpu', 'mps', or 'auto')
            confidence_threshold: Minimum confidence for detections
        """
        self.model_path = model_path
        self.api_endpoint = api_endpoint or os.getenv("SAM3_VIDEO_API_ENDPOINT")
        self.confidence_threshold = confidence_threshold
        self.device = self._get_device(device)
        
        self.model = None
        self.predictor = None
        self._initialized = False
    
    def _get_device(self, device: str) -> str:
        """Determine the best device."""
        if device == "auto":
            if HAS_TORCH and torch.cuda.is_available():
                return "cuda"
            elif HAS_TORCH and hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                return "mps"
            return "cpu"
        return device
    
    def initialize(self) -> bool:
        """Initialize SAM 3 video model."""
        if not HAS_TORCH:
            print("⚠️ PyTorch not available. Install with: pip install torch")
            return False
        
        try:
            from sam3.model_builder import build_sam3_video_model
            
            self.model = build_sam3_video_model(
                checkpoint=self.model_path
            )
            self.model.to(self.device)
            self.model.eval()
            
            # Get the tracker predictor
            self.predictor = self.model.tracker
            
            self._initialized = True
            print(f"✅ SAM 3 Video Model initialized on {self.device}")
            return True
            
        except ImportError:
            print("⚠️ SAM 3 not installed. Install with: pip install sam3")
            return False
        except Exception as e:
            print(f"❌ Failed to initialize SAM 3 Video: {e}")
            return False
    
    def segment_video(
        self,
        video_path: str,
        query: str,
        max_frames: Optional[int] = None,
        output_dir: Optional[str] = None,
        save_visualizations: bool = False
    ) -> VideoSegmentationResult:
        """
        Segment objects in video based on natural language query.
        
        Args:
            video_path: Path to input video file
            query: Natural language description of objects to track
            max_frames: Maximum frames to process (None for all)
            output_dir: Directory to save outputs
            save_visualizations: Whether to save visualized frames
            
        Returns:
            VideoSegmentationResult with tracked objects
        """
        if not HAS_CV2:
            raise ImportError("OpenCV required. Install with: pip install opencv-python")
        
        # Open video
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Could not open video: {video_path}")
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        if max_frames:
            total_frames = min(total_frames, max_frames)
        
        # Initialize tracking
        tracked_objects: List[TrackedObject] = []
        
        if not self._initialized:
            if not self.initialize():
                cap.release()
                return VideoSegmentationResult(
                    tracked_objects=[],
                    total_frames=total_frames,
                    fps=fps,
                    resolution=(width, height),
                    metadata={'error': 'Failed to initialize model'}
                )
        
        # Setup output directory
        if output_dir:
            output_path = Path(output_dir)
            output_path.mkdir(parents=True, exist_ok=True)
        
        # Process first frame to initialize tracking
        ret, first_frame = cap.read()
        if not ret:
            cap.release()
            raise ValueError("Could not read first frame")
        
        first_frame_rgb = cv2.cvtColor(first_frame, cv2.COLOR_BGR2RGB)
        
        # Initialize objects to track on first frame
        tracked_objects = self._init_tracking(first_frame_rgb, query)
        
        # Process remaining frames
        frame_idx = 1
        while frame_idx < total_frames:
            ret, frame = cap.read()
            if not ret:
                break
            
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Track objects in this frame
            self._track_frame(frame_rgb, frame_idx, tracked_objects)
            
            # Save visualization if requested
            if save_visualizations and output_dir:
                vis_frame = self._visualize_frame(frame_rgb, tracked_objects, frame_idx)
                vis_path = Path(output_dir) / f"frame_{frame_idx:06d}.jpg"
                cv2.imwrite(str(vis_path), cv2.cvtColor(vis_frame, cv2.COLOR_RGB2BGR))
            
            frame_idx += 1
            
            # Progress update
            if frame_idx % 30 == 0:
                print(f"📹 Processed {frame_idx}/{total_frames} frames")
        
        cap.release()
        
        result = VideoSegmentationResult(
            tracked_objects=tracked_objects,
            total_frames=frame_idx,
            fps=fps,
            resolution=(width, height),
            metadata={
                'query': query,
                'video_path': video_path,
                'objects_tracked': len(tracked_objects)
            }
        )
        
        # Save result summary
        if output_dir:
            summary_path = Path(output_dir) / "tracking_result.json"
            with open(summary_path, 'w') as f:
                json.dump(result.to_dict(), f, indent=2)
        
        return result
    
    def _init_tracking(
        self,
        frame: Any,
        query: str
    ) -> List[TrackedObject]:
        """Initialize object tracking on first frame."""
        tracked_objects = []
        
        try:
            # Use SAM 3 to find objects matching query
            with torch.no_grad():
                # Process frame with text query
                self.predictor.set_image(frame)
                
                # For text-based querying, we use the image processor
                from sam3.model.sam3_image_processor import Sam3Processor
                
                processor = Sam3Processor(
                    self.model,
                    confidence_threshold=self.confidence_threshold
                )
                
                results = processor.process_image(
                    Image.fromarray(frame),
                    query
                )
                
                masks = results.get('masks', [])
                scores = results.get('scores', [])
                boxes = results.get('boxes', [])
                
                # Create tracked objects
                for i, (mask, score, box) in enumerate(zip(masks, scores, boxes)):
                    if score >= self.confidence_threshold:
                        obj = TrackedObject(
                            object_id=i,
                            label=query
                        )
                        obj.add_detection(0, mask, tuple(box), float(score))
                        tracked_objects.append(obj)
                
                # Initialize tracker with detected objects
                if tracked_objects:
                    self.predictor.init_state(frame)
                    for obj in tracked_objects:
                        detection = obj.track_history[0]
                        self.predictor.add_new_points_or_box(
                            frame_idx=0,
                            obj_id=obj.object_id,
                            box=np.array(detection['box'])
                        )
                        
        except Exception as e:
            print(f"⚠️ Tracking initialization error: {e}")
        
        return tracked_objects
    
    def _track_frame(
        self,
        frame: Any,
        frame_idx: int,
        tracked_objects: List[TrackedObject]
    ):
        """Track objects in a single frame."""
        if not tracked_objects:
            return
        
        try:
            with torch.no_grad():
                # Propagate tracking to this frame
                obj_ids, masks = self.predictor.propagate_in_video(frame)
                
                for obj_id, mask in zip(obj_ids, masks):
                    # Find matching tracked object
                    for obj in tracked_objects:
                        if obj.object_id == obj_id:
                            box = self._mask_to_box(mask)
                            # Calculate confidence based on mask quality
                            score = self._calculate_mask_score(mask)
                            
                            if score >= self.confidence_threshold:
                                obj.add_detection(frame_idx, mask, box, score)
                            break
                            
        except Exception as e:
            print(f"⚠️ Tracking error at frame {frame_idx}: {e}")
    
    def _mask_to_box(self, mask: Any) -> Tuple[int, int, int, int]:
        """Convert mask to bounding box."""
        if mask.sum() == 0:
            return (0, 0, 0, 0)
        
        # Handle torch tensor
        if HAS_TORCH and isinstance(mask, torch.Tensor):
            mask = mask.cpu().numpy()
        
        if mask.ndim > 2:
            mask = mask.squeeze()
        
        rows = np.any(mask > 0.5, axis=1)
        cols = np.any(mask > 0.5, axis=0)
        
        if not rows.any() or not cols.any():
            return (0, 0, 0, 0)
        
        y1, y2 = np.where(rows)[0][[0, -1]]
        x1, x2 = np.where(cols)[0][[0, -1]]
        
        return (int(x1), int(y1), int(x2), int(y2))
    
    def _calculate_mask_score(self, mask: Any) -> float:
        """Calculate quality score for mask."""
        if HAS_TORCH and isinstance(mask, torch.Tensor):
            mask = mask.cpu().numpy()
        
        if mask.ndim > 2:
            mask = mask.squeeze()
        
        # Score based on mask size and quality metrics
        mask_area = (mask > 0.5).sum()
        total_area = mask.size
        
        if total_area == 0:
            return 0.0
        
        # Reasonable object should be between 0.1% and 80% of image
        coverage = mask_area / total_area
        if coverage < 0.001 or coverage > 0.8:
            return 0.3
        
        # Higher confidence for well-defined masks
        mean_confidence = mask[mask > 0.5].mean() if mask_area > 0 else 0
        
        return float(mean_confidence)
    
    def _visualize_frame(
        self,
        frame: Any,
        tracked_objects: List[TrackedObject],
        frame_idx: int
    ) -> Any:
        """Create visualization of tracked objects on frame."""
        vis_frame = frame.copy()
        
        # Colors for different objects
        colors = [
            (255, 0, 0),    # Red
            (0, 255, 0),    # Green
            (0, 0, 255),    # Blue
            (255, 255, 0),  # Yellow
            (255, 0, 255),  # Magenta
            (0, 255, 255),  # Cyan
        ]
        
        for obj in tracked_objects:
            # Find detection for this frame
            for detection in obj.track_history:
                if detection['frame_idx'] == frame_idx:
                    color = colors[obj.object_id % len(colors)]
                    box = detection['box']
                    
                    # Draw bounding box
                    cv2.rectangle(
                        vis_frame,
                        (box[0], box[1]),
                        (box[2], box[3]),
                        color, 2
                    )
                    
                    # Draw label
                    label = f"{obj.label} ({detection['score']:.2f})"
                    cv2.putText(
                        vis_frame,
                        label,
                        (box[0], box[1] - 10),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.5, color, 2
                    )
                    
                    # Overlay mask
                    mask = detection['mask']
                    if HAS_TORCH and isinstance(mask, torch.Tensor):
                        mask = mask.cpu().numpy()
                    if mask.ndim > 2:
                        mask = mask.squeeze()
                    
                    # Create colored overlay
                    overlay = np.zeros_like(vis_frame)
                    overlay[mask > 0.5] = color
                    vis_frame = cv2.addWeighted(vis_frame, 0.7, overlay, 0.3, 0)
                    
                    break
        
        return vis_frame
    
    def track_with_points(
        self,
        video_path: str,
        initial_points: List[Tuple[int, int]],
        point_labels: List[int],
        object_label: str = "tracked_object",
        max_frames: Optional[int] = None,
        output_dir: Optional[str] = None
    ) -> VideoSegmentationResult:
        """
        Track objects in video starting from point prompts.
        
        Args:
            video_path: Path to video
            initial_points: Starting point coordinates [(x, y), ...]
            point_labels: 1 for foreground, 0 for background
            object_label: Label for tracked object
            max_frames: Max frames to process
            output_dir: Output directory
            
        Returns:
            VideoSegmentationResult
        """
        if not HAS_CV2:
            raise ImportError("OpenCV required")
        
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        if max_frames:
            total_frames = min(total_frames, max_frames)
        
        if not self._initialized and not self.initialize():
            cap.release()
            return VideoSegmentationResult(
                tracked_objects=[],
                total_frames=total_frames,
                fps=fps,
                resolution=(width, height),
                metadata={'error': 'Model not initialized'}
            )
        
        # Read first frame
        ret, first_frame = cap.read()
        if not ret:
            cap.release()
            raise ValueError("Could not read first frame")
        
        first_frame_rgb = cv2.cvtColor(first_frame, cv2.COLOR_BGR2RGB)
        
        # Initialize tracking with points
        tracked_object = TrackedObject(object_id=0, label=object_label)
        
        try:
            with torch.no_grad():
                self.predictor.init_state(first_frame_rgb)
                
                # Add initial points
                _, masks, scores, _ = self.predictor.add_new_points_or_box(
                    frame_idx=0,
                    obj_id=0,
                    points=np.array(initial_points),
                    labels=np.array(point_labels)
                )
                
                if len(masks) > 0:
                    best_mask = masks[0]
                    best_score = float(scores[0])
                    box = self._mask_to_box(best_mask)
                    tracked_object.add_detection(0, best_mask, box, best_score)
        
        except Exception as e:
            print(f"❌ Point initialization error: {e}")
            cap.release()
            return VideoSegmentationResult(
                tracked_objects=[],
                total_frames=1,
                fps=fps,
                resolution=(width, height),
                metadata={'error': str(e)}
            )
        
        # Track through remaining frames
        frame_idx = 1
        while frame_idx < total_frames:
            ret, frame = cap.read()
            if not ret:
                break
            
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            try:
                with torch.no_grad():
                    obj_ids, masks = self.predictor.propagate_in_video(frame_rgb)
                    
                    for obj_id, mask in zip(obj_ids, masks):
                        if obj_id == 0:
                            box = self._mask_to_box(mask)
                            score = self._calculate_mask_score(mask)
                            tracked_object.add_detection(frame_idx, mask, box, score)
                            break
            except Exception as e:
                print(f"⚠️ Tracking error at frame {frame_idx}: {e}")
            
            frame_idx += 1
        
        cap.release()
        
        return VideoSegmentationResult(
            tracked_objects=[tracked_object] if tracked_object.frame_count > 0 else [],
            total_frames=frame_idx,
            fps=fps,
            resolution=(width, height),
            metadata={
                'initial_points': initial_points,
                'point_labels': point_labels,
                'object_label': object_label
            }
        )
    
    def extract_frames(
        self,
        video_path: str,
        output_dir: str,
        frame_interval: int = 1,
        max_frames: Optional[int] = None
    ) -> List[str]:
        """
        Extract frames from video for processing.
        
        Args:
            video_path: Path to video
            output_dir: Directory to save frames
            frame_interval: Extract every Nth frame
            max_frames: Maximum frames to extract
            
        Returns:
            List of saved frame paths
        """
        if not HAS_CV2:
            raise ImportError("OpenCV required")
        
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        cap = cv2.VideoCapture(video_path)
        frame_paths = []
        frame_count = 0
        saved_count = 0
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            if frame_count % frame_interval == 0:
                frame_path = output_path / f"frame_{saved_count:06d}.jpg"
                cv2.imwrite(str(frame_path), frame)
                frame_paths.append(str(frame_path))
                saved_count += 1
                
                if max_frames and saved_count >= max_frames:
                    break
            
            frame_count += 1
        
        cap.release()
        return frame_paths


def segment_video(
    video_path: str,
    query: str,
    output_dir: Optional[str] = None,
    max_frames: Optional[int] = None
) -> VideoSegmentationResult:
    """
    Convenience function for video segmentation.
    
    Args:
        video_path: Path to video file
        query: Natural language query for objects to track
        output_dir: Optional output directory
        max_frames: Maximum frames to process
        
    Returns:
        VideoSegmentationResult with tracking data
        
    Example:
        >>> result = segment_video("video.mp4", "track the red car")
        >>> print(f"Tracked {len(result.tracked_objects)} objects")
    """
    processor = Sam3VideoProcessor()
    return processor.segment_video(
        video_path=video_path,
        query=query,
        output_dir=output_dir,
        max_frames=max_frames
    )
