import os
import json
import time
from typing import Dict, Any, List
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate
from web3 import Web3

from goat_plugins.dpsn import dpsn
from goat_plugins.dpsn import DpsnPluginOptions
from goat_adapters.langchain import get_on_chain_tools
from goat_wallets.web3 import Web3EVMWalletClient


load_dotenv()
dpsn_url = os.getenv('DPSN_URL')
dpsn_pvt_key = os.getenv('EVM_WALLET_PVT_KEY')


BASE_RPC_URL = os.getenv("BASE_RPC_URL", "https://mainnet.base.org")
w3 = Web3(Web3.HTTPProvider(BASE_RPC_URL))
private_key = os.getenv("EVM_WALLET_PVT_KEY")
assert private_key is not None, "You must set WALLET_PRIVATE_KEY environment variable"
assert private_key.startswith("0x"), "Private key must start with 0x hex prefix"

# Global message store
# received_messages = []

def handle_dpsn_message(message: Dict[str, Any]):
    print("Received DPSN message:", message)
    return message

# Initialize LLM
llm = ChatOpenAI(model="gpt-4o-mini") # Use a specific model

def main():
      prompt = ChatPromptTemplate.from_messages(
        [
            ("system", """You are the Dpsn plugin tester. You can help users test DPSN functionality including:
1. Subscribe to a specific topic name using dpsn_subscribe.
   Example: "Subscribe to topic 0x123.../some/data"
2. Consume incoming messages on the stream and return the message            
3. Unsubscribe from a topic using dpsn_unsubscribe.
   Example: "Unsubscribe from topic 0x123.../some/data"

Remember to provide the full topic string when asked to subscribe or unsubscribe.
After subscribing, I'll wait for messages and include them in my response."""),
            ("placeholder", "{chat_history}"), # Keep chat history simple for this example
            ("human", "{input}"),
            ("placeholder", "{agent_scratchpad}"),
        ]
    )

      tools = get_on_chain_tools(
            wallet=Web3EVMWalletClient(w3),
            plugins=[
                dpsn(options=DpsnPluginOptions(dpsn_url,dpsn_pvt_key,handle_dpsn_message)) 
            ],
      )

      agent = create_tool_calling_agent(llm,tools,prompt)
      agent_executor = AgentExecutor(agent=agent, tools=tools, handle_parsing_errors=True, verbose=True)

      print("\n DPSN Plugin Test Interface")
      #You can select any topic from the DPSN Streams store
      #https://streams.dpsn.org
      print("Example Commands")
      print("1. Subscribe to   0xe14768a6d8798e4390ec4cb8a4c991202c2115a5cd7a6c0a7ababcaf93b4d2d4/BTCUSDT/ticker topic")
      print("2. Unsubscribe from 0xe14768a6d8798e4390ec4cb8a4c991202c2115a5cd7a6c0a7ababcaf93b4d2d4/BTCUSDT/ticker topic")

      while True:
  
           user_input = input("\n You: ").strip()

           if user_input.lower() == 'exit':
                print("goodbye!")
                break
           try:
                response = agent_executor.invoke({
                     "input": user_input
                })
                      
                print("\n Assistant:", response["output"])

           except Exception as e:
                print("\n Error:", str(e))


if __name__ == "__main__":
    main()

    