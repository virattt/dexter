import openai

from solana_agentkit.agent import SolanaAgentKit
import aiohttp
import aiofiles


class ImageGenerator:
    @staticmethod
    async def create_image(agent:SolanaAgentKit, prompt, size="1024x1024", n=1):
        try:
            if not agent.openai_api_key:
                raise ValueError("OpenAI API key not found in agent configuration")

            openai.api_key = agent.openai_api_key

            response = await openai.Image.create(
                prompt=prompt,
                n=n,
                size=size
            )

            return {
                "images": [img['url'] for img in response['data']]
            }

        except Exception as error:
            raise Exception(f"Image generation failed: {str(error)}")
            @staticmethod
            async def save_image(url, path):
                try:
                    async with aiohttp.ClientSession() as session:
                        async with session.get(url) as response:
                            if response.status != 200:
                                raise Exception(f"Failed to download image: {response.status}")
                        
                            async with aiofiles.open(path, 'wb') as f:
                                await f.write(await response.read())
                except Exception as error:
                    raise Exception(f"Saving image failed: {str(error)}")