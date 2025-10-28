import asyncio
import aiohttp
from .base import BaseSearcher, SearchResult

class GoogleNewsSearcher(BaseSearcher):
    
    def __init__(self, session: aiohttp.ClientSession):
        self.session = session

    @property
    def searcher(self) -> str:
        return "Google News"
    
    async def get_search_results(self, query: str, max_results: int) -> list[SearchResult]:
        search_url = f"https://news.google.com/rss/search?q={query.replace(' ', '%20')}&hl=en-US&gl=US&ceid=US:en"

        async with self.session.get(search_url) as response:
            if response.status != 200:
                return []
            xml_content = await response.text()
            results = self.parse_rss_content(xml_content, max_results)
            resolved_urls = await asyncio.gather(*(self._resolve_google_news_url(r.url) for r in results))
            final: list[SearchResult] = []
            for r, resolved in zip(results, resolved_urls):
                final.append(
                    SearchResult(
                        title=r.title, 
                        url=resolved, 
                        published_date=r.published_date,
                        searcher=self.searcher,
                        )
                    )
            return final

    async def _resolve_google_news_url(self, url: str) -> str:
        if not url or 'news.google.com' not in url:
            return url
        try:
            from googlenewsdecoder import gnewsdecoder
            result = await asyncio.to_thread(gnewsdecoder, url, interval=1)
            if result.get("status"):
                return result["decoded_url"]
            return url
        except Exception:
            return url