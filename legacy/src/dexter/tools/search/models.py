from pydantic import BaseModel
from datetime import datetime

class SearchResult(BaseModel):
    title: str
    url: str
    published_date: datetime | None = None