from langchain.tools import tool
from pydantic import BaseModel, Field
from typing import List, Dict

####################################
# Web Search Tool
####################################

class WebSearchInput(BaseModel):
    query: str = Field(description="The search query to look up on the web. For example, 'Tesla earnings report 2024' or 'NVIDIA stock news'.")
    max_results: int = Field(default=5, description="The maximum number of search results to return. Default is 5.")

@tool(args_schema=WebSearchInput)
def web_search(query: str, max_results: int = 5) -> List[Dict[str, str]]:
    """
    Searches the web using DuckDuckGo to find current information, news, and articles.
    Useful for finding recent financial news, company developments, market trends,
    analyst opinions, and other real-time information not available in financial statements.
    Returns a list of search results with titles, URLs, and snippets.
    """
    try:
        from ddgs import DDGS

        # Perform the search with region set to US for financial content
        ddgs = DDGS()
        results = list(ddgs.text(query, region='us-en', max_results=max_results))

        # Format results for better readability
        formatted_results = []
        for i, result in enumerate(results, 1):
            formatted_results.append({
                "position": i,
                "title": result.get("title", ""),
                "url": result.get("href", ""),
                "snippet": result.get("body", "")
            })

        return formatted_results

    except Exception as e:
        return [{"error": f"Web search failed: {str(e)}"}]
