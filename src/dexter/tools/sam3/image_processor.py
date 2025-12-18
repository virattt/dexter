"""
SAM 3 Image Segmentation Processor.

Provides image segmentation capabilities using Meta AI's SAM 3 model.
Supports natural language queries for identifying and segmenting objects.
"""

import os
import base64
import requests
from io import BytesIO
from typing import Optional, Dict, Any, List, Tuple, Union
from dataclasses import dataclass
from pathlib import Path

try:
    from PIL import Image
    import numpy as np
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

try:
    import torch
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False


@dataclass
class SegmentationResult:
    """Result of an image segmentation operation."""
    masks: List[Any]  # List of segmentation masks
    scores: List[float]  # Confidence scores for each mask
    labels: List[str]  # Labels/descriptions for each segment
    boxes: List[Tuple[int, int, int, int]]  # Bounding boxes (x1, y1, x2, y2)
    metadata: Dict[str, Any]  # Additional metadata


class Sam3ImageProcessor:
    """
    SAM 3 Image Processor for segmentation tasks.
    
    Can operate in two modes:
    1. Local mode: Uses locally installed SAM 3 model
    2. API mode: Uses remote SAM 3 service endpoint
    """
    
    def __init__(
        self,
        model_path: Optional[str] = None,
        bpe_path: Optional[str] = None,
        api_endpoint: Optional[str] = None,
        confidence_threshold: float = 0.5,
        device: str = "auto"
    ):
        """
        Initialize the SAM 3 Image Processor.
        
        Args:
            model_path: Path to local SAM 3 model weights
            bpe_path: Path to BPE tokenizer for text queries
            api_endpoint: URL for remote SAM 3 API service
            confidence_threshold: Minimum confidence for segmentation results
            device: Device to use ('cuda', 'cpu', or 'auto')
        """
        self.model_path = model_path
        self.bpe_path = bpe_path
        self.api_endpoint = api_endpoint or os.getenv("SAM3_API_ENDPOINT")
        self.confidence_threshold = confidence_threshold
        self.device = self._get_device(device)
        
        self.model = None
        self.processor = None
        self._initialized = False
    
    def _get_device(self, device: str) -> str:
        """Determine the best available device."""
        if device == "auto":
            if HAS_TORCH and torch.cuda.is_available():
                return "cuda"
            elif HAS_TORCH and hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                return "mps"
            return "cpu"
        return device
    
    def initialize_local(self) -> bool:
        """Initialize local SAM 3 model."""
        if not HAS_TORCH:
            print("⚠️ PyTorch not available. Install with: pip install torch")
            return False
            
        try:
            from sam3 import build_sam3_image_model
            from sam3.model.sam3_image_processor import Sam3Processor
            
            self.model = build_sam3_image_model(
                bpe_path=self.bpe_path,
                model_path=self.model_path
            )
            self.model.to(self.device)
            self.model.eval()
            
            self.processor = Sam3Processor(
                self.model,
                confidence_threshold=self.confidence_threshold
            )
            
            self._initialized = True
            print(f"✅ SAM 3 Image Model initialized on {self.device}")
            return True
            
        except ImportError:
            print("⚠️ SAM 3 not installed. Install with: pip install sam3")
            return False
        except Exception as e:
            print(f"❌ Failed to initialize SAM 3: {e}")
            return False
    
    def segment_with_text(
        self,
        image: Union[str, "Image.Image", np.ndarray],
        query: str,
        return_visualization: bool = False
    ) -> SegmentationResult:
        """
        Segment image based on natural language query.
        
        Args:
            image: Image path, URL, PIL Image, or numpy array
            query: Natural language description of what to segment
            return_visualization: Whether to include visualization in result
            
        Returns:
            SegmentationResult with masks, scores, labels and boxes
        """
        # Load image if needed
        img = self._load_image(image)
        
        if self.api_endpoint:
            return self._segment_via_api(img, query, return_visualization)
        elif self._initialized:
            return self._segment_local(img, query, return_visualization)
        else:
            # Try to initialize local model
            if self.initialize_local():
                return self._segment_local(img, query, return_visualization)
            raise RuntimeError("SAM 3 not initialized. Set api_endpoint or install local model.")
    
    def segment_with_points(
        self,
        image: Union[str, "Image.Image", np.ndarray],
        points: List[Tuple[int, int]],
        labels: List[int],  # 1 for foreground, 0 for background
        return_visualization: bool = False
    ) -> SegmentationResult:
        """
        Segment image based on point prompts.
        
        Args:
            image: Image path, URL, PIL Image, or numpy array
            points: List of (x, y) coordinates
            labels: 1 for foreground points, 0 for background
            return_visualization: Whether to include visualization
            
        Returns:
            SegmentationResult with masks and scores
        """
        img = self._load_image(image)
        
        if not self._initialized and not self.initialize_local():
            raise RuntimeError("SAM 3 not initialized for point-based segmentation")
        
        return self._segment_with_points_local(img, points, labels, return_visualization)
    
    def segment_with_box(
        self,
        image: Union[str, "Image.Image", np.ndarray],
        box: Tuple[int, int, int, int],  # x1, y1, x2, y2
        return_visualization: bool = False
    ) -> SegmentationResult:
        """
        Segment image based on bounding box.
        
        Args:
            image: Image path, URL, PIL Image, or numpy array
            box: Bounding box as (x1, y1, x2, y2)
            return_visualization: Whether to include visualization
            
        Returns:
            SegmentationResult with masks and scores
        """
        img = self._load_image(image)
        
        if not self._initialized and not self.initialize_local():
            raise RuntimeError("SAM 3 not initialized for box-based segmentation")
        
        return self._segment_with_box_local(img, box, return_visualization)
    
    def _load_image(self, image: Union[str, "Image.Image", np.ndarray]) -> "Image.Image":
        """Load image from various sources."""
        if not HAS_PIL:
            raise ImportError("PIL required. Install with: pip install Pillow")
        
        if isinstance(image, Image.Image):
            return image
        elif isinstance(image, np.ndarray):
            return Image.fromarray(image)
        elif isinstance(image, str):
            if image.startswith(('http://', 'https://')):
                response = requests.get(image)
                return Image.open(BytesIO(response.content))
            elif image.startswith('data:image'):
                # Base64 encoded image
                header, data = image.split(',', 1)
                return Image.open(BytesIO(base64.b64decode(data)))
            else:
                return Image.open(image)
        else:
            raise ValueError(f"Unsupported image type: {type(image)}")
    
    def _segment_local(
        self,
        image: "Image.Image",
        query: str,
        return_visualization: bool
    ) -> SegmentationResult:
        """Run local SAM 3 segmentation."""
        try:
            # Process with SAM 3
            results = self.processor.process_image(image, query)
            
            masks = results.get('masks', [])
            scores = results.get('scores', [])
            boxes = results.get('boxes', [])
            
            # Filter by confidence
            filtered_masks = []
            filtered_scores = []
            filtered_boxes = []
            
            for mask, score, box in zip(masks, scores, boxes):
                if score >= self.confidence_threshold:
                    filtered_masks.append(mask)
                    filtered_scores.append(float(score))
                    filtered_boxes.append(tuple(box))
            
            metadata = {
                'query': query,
                'image_size': image.size,
                'device': self.device,
                'total_detections': len(masks),
                'filtered_detections': len(filtered_masks)
            }
            
            if return_visualization:
                metadata['visualization'] = self._create_visualization(
                    image, filtered_masks, filtered_boxes
                )
            
            return SegmentationResult(
                masks=filtered_masks,
                scores=filtered_scores,
                labels=[query] * len(filtered_masks),
                boxes=filtered_boxes,
                metadata=metadata
            )
            
        except Exception as e:
            print(f"❌ Local segmentation error: {e}")
            return SegmentationResult(
                masks=[],
                scores=[],
                labels=[],
                boxes=[],
                metadata={'error': str(e)}
            )
    
    def _segment_via_api(
        self,
        image: "Image.Image",
        query: str,
        return_visualization: bool
    ) -> SegmentationResult:
        """Run segmentation via remote API."""
        try:
            # Convert image to base64
            buffered = BytesIO()
            image.save(buffered, format="PNG")
            img_base64 = base64.b64encode(buffered.getvalue()).decode()
            
            # Call API
            response = requests.post(
                f"{self.api_endpoint}/segment",
                json={
                    'image': img_base64,
                    'query': query,
                    'confidence_threshold': self.confidence_threshold,
                    'return_visualization': return_visualization
                },
                timeout=60
            )
            response.raise_for_status()
            
            data = response.json()
            
            return SegmentationResult(
                masks=data.get('masks', []),
                scores=data.get('scores', []),
                labels=data.get('labels', []),
                boxes=[tuple(b) for b in data.get('boxes', [])],
                metadata=data.get('metadata', {})
            )
            
        except Exception as e:
            print(f"❌ API segmentation error: {e}")
            return SegmentationResult(
                masks=[],
                scores=[],
                labels=[],
                boxes=[],
                metadata={'error': str(e)}
            )
    
    def _segment_with_points_local(
        self,
        image: "Image.Image",
        points: List[Tuple[int, int]],
        labels: List[int],
        return_visualization: bool
    ) -> SegmentationResult:
        """Point-based segmentation using local model."""
        try:
            import torch
            
            # Convert to numpy
            img_array = np.array(image)
            
            with torch.no_grad():
                # Set image
                self.processor.set_image(img_array)
                
                # Predict with points
                point_coords = np.array(points)
                point_labels = np.array(labels)
                
                masks, scores, _ = self.processor.predict(
                    point_coords=point_coords,
                    point_labels=point_labels,
                    multimask_output=True
                )
            
            # Get best mask
            best_idx = np.argmax(scores)
            
            metadata = {
                'points': points,
                'labels': labels,
                'image_size': image.size
            }
            
            return SegmentationResult(
                masks=[masks[best_idx]],
                scores=[float(scores[best_idx])],
                labels=['point_segment'],
                boxes=[self._mask_to_box(masks[best_idx])],
                metadata=metadata
            )
            
        except Exception as e:
            return SegmentationResult(
                masks=[], scores=[], labels=[], boxes=[],
                metadata={'error': str(e)}
            )
    
    def _segment_with_box_local(
        self,
        image: "Image.Image",
        box: Tuple[int, int, int, int],
        return_visualization: bool
    ) -> SegmentationResult:
        """Box-based segmentation using local model."""
        try:
            import torch
            
            img_array = np.array(image)
            
            with torch.no_grad():
                self.processor.set_image(img_array)
                
                masks, scores, _ = self.processor.predict(
                    box=np.array(box),
                    multimask_output=True
                )
            
            best_idx = np.argmax(scores)
            
            return SegmentationResult(
                masks=[masks[best_idx]],
                scores=[float(scores[best_idx])],
                labels=['box_segment'],
                boxes=[box],
                metadata={'input_box': box, 'image_size': image.size}
            )
            
        except Exception as e:
            return SegmentationResult(
                masks=[], scores=[], labels=[], boxes=[],
                metadata={'error': str(e)}
            )
    
    def _mask_to_box(self, mask: np.ndarray) -> Tuple[int, int, int, int]:
        """Convert binary mask to bounding box."""
        if mask.sum() == 0:
            return (0, 0, 0, 0)
        
        rows = np.any(mask, axis=1)
        cols = np.any(mask, axis=0)
        y1, y2 = np.where(rows)[0][[0, -1]]
        x1, x2 = np.where(cols)[0][[0, -1]]
        
        return (int(x1), int(y1), int(x2), int(y2))
    
    def _create_visualization(
        self,
        image: "Image.Image",
        masks: List[np.ndarray],
        boxes: List[Tuple[int, int, int, int]]
    ) -> "Image.Image":
        """Create visualization with masks overlaid."""
        if not masks:
            return image
        
        # Convert to RGBA for transparency
        vis_image = image.convert('RGBA')
        
        # Colors for different masks
        colors = [
            (255, 0, 0, 100),    # Red
            (0, 255, 0, 100),    # Green
            (0, 0, 255, 100),    # Blue
            (255, 255, 0, 100),  # Yellow
            (255, 0, 255, 100),  # Magenta
            (0, 255, 255, 100),  # Cyan
        ]
        
        for i, mask in enumerate(masks):
            color = colors[i % len(colors)]
            
            # Create colored mask overlay
            mask_image = Image.new('RGBA', image.size, (0, 0, 0, 0))
            mask_array = np.array(mask_image)
            
            if isinstance(mask, np.ndarray):
                mask_array[mask > 0] = color
            
            mask_image = Image.fromarray(mask_array)
            vis_image = Image.alpha_composite(vis_image, mask_image)
        
        return vis_image


def segment_image(
    image: Union[str, Any],
    query: str,
    api_endpoint: Optional[str] = None,
    confidence: float = 0.5
) -> SegmentationResult:
    """
    Convenience function for quick image segmentation.
    
    Args:
        image: Image path, URL, or PIL Image
        query: Natural language query describing what to segment
        api_endpoint: Optional SAM 3 API endpoint
        confidence: Minimum confidence threshold
        
    Returns:
        SegmentationResult with masks, scores, labels and boxes
        
    Example:
        >>> result = segment_image("photo.jpg", "find all the cars")
        >>> print(f"Found {len(result.masks)} cars")
    """
    processor = Sam3ImageProcessor(
        api_endpoint=api_endpoint,
        confidence_threshold=confidence
    )
    return processor.segment_with_text(image, query)
