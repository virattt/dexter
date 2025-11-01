import requests
from dexter.tools.search.models import SearchResult
from dexter.tools.search.utils import parse_rss_content
from langchain.tools import tool
from pydantic import BaseModel, Field

class SearchGoogleNewsInput(BaseModel):
    query: str = Field(description="The search query to send to Google News. For example, 'Apple earnings'")
    max_results: int = Field(default=5, description="The maximum number of results to retrieve.")

@tool(args_schema=SearchGoogleNewsInput)
def search_google_news(query: str, max_results: int = 5) -> list[SearchResult]:
    """
    Search Google News for articles matching a given query.
    This tool should be used to search Google News for recent
    news articles, current events, or information about specific topics.
    """
    search_url = f"https://news.google.com/rss/search?q={query.replace(' ', '%20')}&hl=en-US&gl=US&ceid=US:en"

    response = requests.get(search_url)
    if response.status_code != 200:
        return []
    xml_content = response.text
    results = parse_rss_content(xml_content, max_results)
    resolved_urls = [_resolve_google_news_url(result.url) for result in results]
    final: list[SearchResult] = []
    for r, resolved in zip(results, resolved_urls):
        final.append(
            SearchResult(
                title=r.title, 
                url=resolved, 
                published_date=r.published_date,
              )
            )
    return final

def _resolve_google_news_url(url: str) -> str:
    if not url or 'news.google.com' not in url:
        return url
    try:
        from googlenewsdecoder import gnewsdecoder
        result = gnewsdecoder(url, interval=1)
        if result.get("status"):
            return result["decoded_url"]
        return url
    except Exception:
        return url