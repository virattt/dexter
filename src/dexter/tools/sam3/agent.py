"""
SAM 3 Agent - MLLM-powered Vision Agent for Complex Segmentation Queries.

This module provides an AI agent interface that uses SAM 3 as its vision tool,
enabling complex natural language queries for image and video segmentation.
"""

import os
import json
import base64
from io import BytesIO
from typing import Optional, Dict, Any, List, Union, Callable
from dataclasses import dataclass
from pathlib import Path

try:
    from PIL import Image
    import numpy as np
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

from .image_processor import Sam3ImageProcessor, SegmentationResult
from .video_processor import Sam3VideoProcessor, VideoSegmentationResult


@dataclass
class AgentResponse:
    """Response from SAM 3 Agent."""
    query: str
    interpretation: str  # How the agent interpreted the query
    action: str  # What action was taken
    results: Union[SegmentationResult, VideoSegmentationResult, None]
    explanation: str  # Human-readable explanation of results
    confidence: float
    metadata: Dict[str, Any]


class Sam3Agent:
    """
    SAM 3 Vision Agent - MLLM using SAM 3 for complex text-based segmentation.
    
    The agent interprets natural language queries and uses SAM 3 to:
    - Identify and segment objects in images
    - Track objects across video frames
    - Answer complex visual questions
    - Generate detailed segmentation reports
    
    Example:
        >>> agent = Sam3Agent()
        >>> response = agent.query(
        ...     "Find all the people wearing red shirts in this image",
        ...     image="crowd.jpg"
        ... )
        >>> print(response.explanation)
    """
    
    def __init__(
        self,
        llm_endpoint: Optional[str] = None,
        llm_api_key: Optional[str] = None,
        sam3_api_endpoint: Optional[str] = None,
        model_name: str = "gpt-4-vision-preview",
        confidence_threshold: float = 0.5,
        device: str = "auto"
    ):
        """
        Initialize SAM 3 Agent.
        
        Args:
            llm_endpoint: LLM API endpoint (default: OpenAI)
            llm_api_key: API key for LLM service
            sam3_api_endpoint: Optional remote SAM 3 service endpoint
            model_name: LLM model to use for query interpretation
            confidence_threshold: Minimum confidence for results
            device: Device for local SAM 3 model
        """
        self.llm_endpoint = llm_endpoint or "https://api.openai.com/v1/chat/completions"
        self.llm_api_key = llm_api_key or os.getenv("OPENAI_API_KEY")
        self.model_name = model_name
        self.confidence_threshold = confidence_threshold
        
        # Initialize processors
        self.image_processor = Sam3ImageProcessor(
            api_endpoint=sam3_api_endpoint,
            confidence_threshold=confidence_threshold,
            device=device
        )
        self.video_processor = Sam3VideoProcessor(
            api_endpoint=sam3_api_endpoint,
            confidence_threshold=confidence_threshold,
            device=device
        )
        
        # Action handlers
        self._actions: Dict[str, Callable] = {
            'segment_object': self._action_segment_object,
            'count_objects': self._action_count_objects,
            'locate_object': self._action_locate_object,
            'track_object': self._action_track_object,
            'compare_objects': self._action_compare_objects,
            'describe_scene': self._action_describe_scene,
        }
    
    def query(
        self,
        query: str,
        image: Optional[Union[str, "Image.Image"]] = None,
        video: Optional[str] = None,
        context: Optional[str] = None
    ) -> AgentResponse:
        """
        Process a natural language query about an image or video.
        
        Args:
            query: Natural language query (e.g., "Find all red cars")
            image: Image path, URL, or PIL Image
            video: Video path for video queries
            context: Additional context for the query
            
        Returns:
            AgentResponse with segmentation results and explanation
        """
        if not image and not video:
            return AgentResponse(
                query=query,
                interpretation="No media provided",
                action="error",
                results=None,
                explanation="Please provide an image or video to analyze.",
                confidence=0.0,
                metadata={'error': 'No media provided'}
            )
        
        # Interpret the query
        interpretation = self._interpret_query(query, context)
        
        # Determine action and execute
        action = interpretation.get('action', 'segment_object')
        target = interpretation.get('target', query)
        
        try:
            if video:
                results = self._process_video_query(video, target, action, interpretation)
            else:
                results = self._process_image_query(image, target, action, interpretation)
            
            # Generate explanation
            explanation = self._generate_explanation(query, action, results, interpretation)
            
            return AgentResponse(
                query=query,
                interpretation=interpretation.get('interpretation', query),
                action=action,
                results=results,
                explanation=explanation,
                confidence=interpretation.get('confidence', 0.8),
                metadata={
                    'raw_interpretation': interpretation,
                    'target': target
                }
            )
            
        except Exception as e:
            return AgentResponse(
                query=query,
                interpretation=interpretation.get('interpretation', query),
                action="error",
                results=None,
                explanation=f"Error processing query: {str(e)}",
                confidence=0.0,
                metadata={'error': str(e)}
            )
    
    def _interpret_query(self, query: str, context: Optional[str] = None) -> Dict[str, Any]:
        """Use LLM to interpret the query and determine action."""
        
        # If no LLM API key, use simple pattern matching
        if not self.llm_api_key:
            return self._simple_interpret(query)
        
        try:
            import requests
            
            system_prompt = """You are a vision AI assistant that interprets user queries about images and videos.
            
Given a query, determine:
1. The action to take: segment_object, count_objects, locate_object, track_object, compare_objects, describe_scene
2. The target object(s) to find
3. Any specific attributes (color, size, position, etc.)
4. Your confidence in understanding the query

Respond in JSON format:
{
    "action": "segment_object",
    "target": "the specific object to find",
    "attributes": ["color:red", "size:large"],
    "interpretation": "Human-readable interpretation of what to do",
    "confidence": 0.9
}"""

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Query: {query}" + (f"\nContext: {context}" if context else "")}
            ]
            
            response = requests.post(
                self.llm_endpoint,
                headers={
                    "Authorization": f"Bearer {self.llm_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": self.model_name.replace("-vision-preview", ""),
                    "messages": messages,
                    "temperature": 0.3,
                    "max_tokens": 500
                },
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()
            content = result['choices'][0]['message']['content']
            
            # Parse JSON from response
            if '```json' in content:
                content = content.split('```json')[1].split('```')[0]
            elif '```' in content:
                content = content.split('```')[1].split('```')[0]
            
            return json.loads(content.strip())
            
        except Exception as e:
            print(f"⚠️ LLM interpretation failed: {e}, using simple interpretation")
            return self._simple_interpret(query)
    
    def _simple_interpret(self, query: str) -> Dict[str, Any]:
        """Simple pattern-based query interpretation."""
        query_lower = query.lower()
        
        # Determine action
        action = "segment_object"
        if any(word in query_lower for word in ['count', 'how many', 'number of']):
            action = "count_objects"
        elif any(word in query_lower for word in ['where', 'locate', 'find', 'position']):
            action = "locate_object"
        elif any(word in query_lower for word in ['track', 'follow', 'movement']):
            action = "track_object"
        elif any(word in query_lower for word in ['compare', 'difference', 'similar']):
            action = "compare_objects"
        elif any(word in query_lower for word in ['describe', 'what is', 'tell me about']):
            action = "describe_scene"
        
        # Extract target - use original query as target for segmentation
        target = query
        
        # Try to extract specific nouns
        stop_words = {'find', 'all', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'of', 
                     'this', 'that', 'image', 'photo', 'picture', 'video', 'where',
                     'how', 'many', 'count', 'locate', 'track', 'segment'}
        
        words = query_lower.split()
        content_words = [w for w in words if w not in stop_words]
        if content_words:
            target = ' '.join(content_words)
        
        return {
            'action': action,
            'target': target,
            'attributes': [],
            'interpretation': f"Looking for: {target}",
            'confidence': 0.7
        }
    
    def _process_image_query(
        self,
        image: Union[str, "Image.Image"],
        target: str,
        action: str,
        interpretation: Dict[str, Any]
    ) -> SegmentationResult:
        """Process an image query."""
        
        # All actions use segmentation as base
        result = self.image_processor.segment_with_text(
            image=image,
            query=target,
            return_visualization=True
        )
        
        return result
    
    def _process_video_query(
        self,
        video_path: str,
        target: str,
        action: str,
        interpretation: Dict[str, Any]
    ) -> VideoSegmentationResult:
        """Process a video query."""
        
        return self.video_processor.segment_video(
            video_path=video_path,
            query=target,
            max_frames=300  # Limit for performance
        )
    
    def _generate_explanation(
        self,
        query: str,
        action: str,
        results: Union[SegmentationResult, VideoSegmentationResult, None],
        interpretation: Dict[str, Any]
    ) -> str:
        """Generate human-readable explanation of results."""
        
        if results is None:
            return "No results were obtained from the analysis."
        
        if isinstance(results, SegmentationResult):
            return self._explain_image_results(query, action, results, interpretation)
        else:
            return self._explain_video_results(query, action, results, interpretation)
    
    def _explain_image_results(
        self,
        query: str,
        action: str,
        results: SegmentationResult,
        interpretation: Dict[str, Any]
    ) -> str:
        """Explain image segmentation results."""
        
        num_found = len(results.masks)
        target = interpretation.get('target', query)
        
        if num_found == 0:
            return f"I couldn't find any '{target}' in the image. Try being more specific or checking if the object is visible."
        
        if action == "count_objects":
            return f"I found {num_found} instance(s) of '{target}' in the image."
        
        elif action == "locate_object":
            locations = []
            img_size = results.metadata.get('image_size', (1000, 1000))
            
            for i, box in enumerate(results.boxes):
                x_center = (box[0] + box[2]) / 2
                y_center = (box[1] + box[3]) / 2
                
                # Determine position
                h_pos = "left" if x_center < img_size[0] / 3 else "right" if x_center > img_size[0] * 2/3 else "center"
                v_pos = "top" if y_center < img_size[1] / 3 else "bottom" if y_center > img_size[1] * 2/3 else "middle"
                
                locations.append(f"{v_pos}-{h_pos}")
            
            unique_locations = list(set(locations))
            return f"Found {num_found} '{target}': located at {', '.join(unique_locations)}"
        
        else:  # segment_object or default
            avg_confidence = sum(results.scores) / len(results.scores) if results.scores else 0
            return f"Successfully segmented {num_found} instance(s) of '{target}' with {avg_confidence:.1%} average confidence."
    
    def _explain_video_results(
        self,
        query: str,
        action: str,
        results: VideoSegmentationResult,
        interpretation: Dict[str, Any]
    ) -> str:
        """Explain video segmentation results."""
        
        num_objects = len(results.tracked_objects)
        target = interpretation.get('target', query)
        
        if num_objects == 0:
            return f"I couldn't track any '{target}' in the video."
        
        explanations = [f"Tracked {num_objects} object(s) matching '{target}' across {results.total_frames} frames."]
        
        for obj in results.tracked_objects:
            coverage = obj.frame_count / results.total_frames * 100
            explanations.append(
                f"- Object {obj.object_id}: visible in {obj.frame_count} frames ({coverage:.1f}% coverage), "
                f"avg confidence: {obj.average_score:.1%}"
            )
        
        return "\n".join(explanations)
    
    # Action handlers
    def _action_segment_object(self, image, target, interpretation):
        """Segment specific objects."""
        return self.image_processor.segment_with_text(image, target)
    
    def _action_count_objects(self, image, target, interpretation):
        """Count objects in image."""
        return self.image_processor.segment_with_text(image, target)
    
    def _action_locate_object(self, image, target, interpretation):
        """Locate objects and return positions."""
        return self.image_processor.segment_with_text(image, target)
    
    def _action_track_object(self, video, target, interpretation):
        """Track objects across video."""
        return self.video_processor.segment_video(video, target)
    
    def _action_compare_objects(self, image, target, interpretation):
        """Compare different objects."""
        return self.image_processor.segment_with_text(image, target)
    
    def _action_describe_scene(self, image, target, interpretation):
        """Describe the scene."""
        return self.image_processor.segment_with_text(image, "all objects")
    
    def batch_query(
        self,
        queries: List[str],
        image: Optional[Union[str, "Image.Image"]] = None,
        video: Optional[str] = None
    ) -> List[AgentResponse]:
        """
        Process multiple queries on the same media.
        
        Args:
            queries: List of natural language queries
            image: Image to analyze
            video: Video to analyze
            
        Returns:
            List of AgentResponse for each query
        """
        return [self.query(q, image=image, video=video) for q in queries]
    
    def interactive_session(
        self,
        image: Optional[Union[str, "Image.Image"]] = None,
        video: Optional[str] = None
    ):
        """
        Start an interactive query session.
        
        Args:
            image: Image to analyze
            video: Video to analyze
        """
        print("🤖 SAM 3 Agent Interactive Session")
        print("Type 'quit' to exit, 'help' for commands")
        print("-" * 40)
        
        media_type = "video" if video else "image" if image else "none"
        print(f"Media loaded: {media_type}")
        
        while True:
            try:
                query = input("\n🔍 Query: ").strip()
                
                if query.lower() == 'quit':
                    print("Goodbye!")
                    break
                elif query.lower() == 'help':
                    print("""
Commands:
  - Type any natural language query about the image/video
  - Examples:
    - "Find all the cars"
    - "How many people are there?"
    - "Where is the dog?"
    - "Track the red ball"
  - quit: Exit the session
                    """)
                    continue
                elif not query:
                    continue
                
                response = self.query(query, image=image, video=video)
                
                print(f"\n📊 Action: {response.action}")
                print(f"💭 Interpretation: {response.interpretation}")
                print(f"📝 Result: {response.explanation}")
                print(f"🎯 Confidence: {response.confidence:.1%}")
                
            except KeyboardInterrupt:
                print("\nSession interrupted. Goodbye!")
                break


def run_segmentation_query(
    query: str,
    image: Optional[Union[str, Any]] = None,
    video: Optional[str] = None,
    api_key: Optional[str] = None
) -> AgentResponse:
    """
    Convenience function to run a segmentation query.
    
    Args:
        query: Natural language query
        image: Image path, URL, or PIL Image
        video: Video path
        api_key: Optional OpenAI API key for query interpretation
        
    Returns:
        AgentResponse with results
        
    Example:
        >>> response = run_segmentation_query(
        ...     "Find all the people in red",
        ...     image="crowd.jpg"
        ... )
        >>> print(response.explanation)
    """
    agent = Sam3Agent(llm_api_key=api_key)
    return agent.query(query, image=image, video=video)
