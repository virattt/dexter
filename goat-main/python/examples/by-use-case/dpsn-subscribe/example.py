import os
import json
import time
from typing import Dict, Any
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate
from web3 import Web3

# Correct import path for the plugin
from goat_plugins.dpsn import dpsn,DpsnPluginOptions
# Import necessary functions from goat-sdk
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

def handle_dpsn_message(message: Dict[str, Any]):
    print("Received DPSN message:", message)


def main():
      tools = get_on_chain_tools(
            wallet=Web3EVMWalletClient(w3),
            plugins=[
                dpsn(options=DpsnPluginOptions(dpsn_url,dpsn_pvt_key,handle_dpsn_message)) 
            ],
      )


      # Find the dpsn_subscription_tool by name
      dpsn_sub_tool = next(tool for tool in tools if tool.name == 'dpsn_subscription_tool')
      #You can select any topic from the DPSN Streams store
      #https://streams.dpsn.org
      # Using the topic for  btc price ticker and ohlcv updates from binance top 10 tokens price feed topic from the DPSN Streams store
 
      # Execute the tool with a topic parameter
      topic_ticker = "0xe14768a6d8798e4390ec4cb8a4c991202c2115a5cd7a6c0a7ababcaf93b4d2d4/BTCUSDT/ticker" 
      topic_ohlc = "0xe14768a6d8798e4390ec4cb8a4c991202c2115a5cd7a6c0a7ababcaf93b4d2d4/BTCUSDT/ohlc"  # Replace with your actual topic
       # Replace with your actual topic
      result_ticker = dpsn_sub_tool.invoke({"dpsn_topic": topic_ticker})
      resukt_ohlc = dpsn_sub_tool.invoke({"dpsn_topic": topic_ohlc})


       
      # Wait for messages
      print("Waiting for messages on topic...")
      time.sleep(120)  # Wait to see if we receive any messages
      
      # Find and execute the unsubscribe tool
      dpsn_unsub_tool = next(tool for tool in tools if tool.name == 'dpsn_unsubscribe_tool')
      unsub_ticker = dpsn_unsub_tool.invoke({"dpsn_topic": topic_ticker})
      unsubt_ohlc = dpsn_unsub_tool.invoke({"dpsn_topic": topic_ohlc})

      print(f"Unsubscription ticker: {unsub_ticker}")
      print(f"Unsubscription ticker: {unsub_ohlc}")



if __name__ == "__main__":
    main()

    