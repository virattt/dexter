# src/solana_agentkit/utils/image.py

from typing import Dict, Optional
from dataclasses import dataclass
import aiohttp
import base64
from PIL import Image
import io
import logging
import os

from solana_agentkit.agent.solana_agent import SolanaAgent

logger = logging.getLogger(__name__)

@dataclass
class ImageGenerationResult:
    """Result from image generation."""
    url: str
    revised_prompt: Optional[str] = None
    base64_data: Optional[str] = None

async def create_image(
    agent: 'SolanaAgent',
    prompt: str,
    size: str = "1024x1024",
    quality: str = "standard",
    style: str = "natural",
    save_local: bool = False
) -> ImageGenerationResult:
    """
    Create an image using OpenAI's DALL-E.
    
    Args:
        agent: SolanaAgentKit instance
        prompt: Image description/prompt
        size: Image size (1024x1024, 1024x1792, or 1792x1024)
        quality: Image quality (standard or hd)
        style: Image style (natural or vivid)
        save_local: Whether to save the image locally
        
    Returns:
        ImageGenerationResult containing image URL and optional data
        
    Raises:
        Exception: If image creation fails
    """
    try:
        if not agent.openai_api_key:
            raise ValueError("OpenAI API key not configured")
            
        # Validate parameters
        valid_sizes = ["1024x1024", "1024x1792", "1792x1024"]
        if size not in valid_sizes:
            raise ValueError(f"Size must be one of {valid_sizes}")
            
        if quality not in ["standard", "hd"]:
            raise ValueError("Quality must be 'standard' or 'hd'")
            
        if style not in ["natural", "vivid"]:
            raise ValueError("Style must be 'natural' or 'vivid'")
            
        # Prepare request
        url = "https://api.openai.com/v1/images/generations"
        headers = {
            "Authorization": f"Bearer {agent.openai_api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "dall-e-3",
            "prompt": prompt,
            "n": 1,
            "size": size,
            "quality": quality,
            "style": style,
            "response_format": "url"
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=payload) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"OpenAI API error: {error_text}")
                    
                data = await response.json()
                image_url = data['data'][0]['url']
                revised_prompt = data['data'][0].get('revised_prompt')
                
                # Save image locally if requested
                if save_local:
                    await download_and_save_image(image_url, prompt)
                
                return ImageGenerationResult(
                    url=image_url,
                    revised_prompt=revised_prompt
                )
                
    except Exception as error:
        raise Exception(f"Image creation failed: {str(error)}") from error

async def download_and_save_image(url: str, prompt: str) -> str:
    """
    Download and save an image locally.
    
    Args:
        url: Image URL
        prompt: Original prompt (used for filename)
        
    Returns:
        Local file path
    """
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status != 200:
                    raise Exception(f"Failed to download image: {response.status}")
                    
                image_data = await response.read()
                
                # Create safe filename from prompt
                safe_name = "".join(x for x in prompt if x.isalnum() or x in "._- ")[:50]
                filename = f"generated_image_{safe_name}.png"
                
                # Save image
                with open(filename, "wb") as f:
                    f.write(image_data)
                    
                return filename
                
    except Exception as error:
        logger.error(f"Failed to save image: {error}")
        raise

class ImageGenerator:
    """Helper class for image generation."""
    
    def __init__(self, agent: 'SolanaAgent'):
        self.agent = agent
        self._generated_images: list[ImageGenerationResult] = []
        
    async def generate(
        self,
        prompt: str,
        **kwargs
    ) -> ImageGenerationResult:
        """Generate an image with the given prompt."""
        result = await create_image(self.agent, prompt, **kwargs)
        self._generated_images.append(result)
        return result
        
    def get_generation_history(self) -> list[ImageGenerationResult]:
        """Get list of all generated images."""
        return self._generated_images.copy()
        
    async def convert_to_base64(self, url: str) -> str:
        """Convert image URL to base64 string."""
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status != 200:
                    raise Exception("Failed to download image")
                    
                image_data = await response.read()
                return base64.b64encode(image_data).decode('utf-8')
                
    async def optimize_image(
        self,
        url: str,
        max_size_kb: int = 500
    ) -> str:
        """
        Download and optimize image to meet size requirements.
        
        Args:
            url: Image URL
            max_size_kb: Maximum size in KB
            
        Returns:
            Base64 encoded optimized image
        """
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                image_data = await response.read()
                
        # Open with Pillow
        image = Image.open(io.BytesIO(image_data))
        
        # Calculate current size
        current_size = len(image_data) / 1024  # KB
        
        if current_size <= max_size_kb:
            return base64.b64encode(image_data).decode('utf-8')
            
        # Optimize by reducing quality
        quality = 95
        while current_size > max_size_kb and quality > 50:
            buffer = io.BytesIO()
            image.save(buffer, format='PNG', optimize=True, quality=quality)
            current_size = len(buffer.getvalue()) / 1024
            quality -= 5
            
        return base64.b64encode(buffer.getvalue()).decode('utf-8')