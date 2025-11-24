from solana_agentkit.agent import SolanaAgent
from solana_agentkit.tools import JupiterTradeTool, TokenDeployTool
from langchain.llms import OpenAI
import asyncio

async def main():
    # Initialize language model
    llm = OpenAI(temperature=0.7)
    
    # Initialize tools
    tools = [
        JupiterTradeTool(),
        TokenDeployTool()
    ]
    
    # Create agent
    agent = SolanaAgent(
        llm=llm,
        tools=tools,
        rpc_url="https://api.mainnet-beta.solana.com"
    )
    
    # Initialize agent
    await agent.initialize()
    
    # Process a message
    response = await agent.process_message(
        "Deploy a new token called 'MyToken' with symbol 'MTK'"
    )
    print(response)
    
    # Cleanup
    await agent.cleanup()

if __name__ == "__main__":
    asyncio.run(main())