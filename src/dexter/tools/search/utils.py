import re
from typing import List
from dexter.tools.search.models import SearchResult
from datetime import datetime

def parse_rss_content(xml_content: str, max_results: int) -> List[SearchResult]:
  try:
      from xml.etree import ElementTree as ET
      root = ET.fromstring(xml_content)
      results: List[SearchResult] = []

      items = root.findall('.//item')[:max_results * 2]

      for item in items:
          title_elem = item.find('title')
          link_elem = item.find('link')
          date_elem = item.find('pubDate')

          title = title_elem.text if title_elem is not None else "No title"
          url = link_elem.text if link_elem is not None else ""
          pub_date = date_elem.text if date_elem is not None else ""

          results.append(
              SearchResult(
                  title=_clean_text(title),
                  url=url,
                  published_date=_parse_rss_date(pub_date),
              )
          )

          if len(results) >= max_results:
              break

      return results

  except ET.ParseError:
      return []

def _parse_rss_date(date_str: str) -> datetime | None:
    if not date_str:
        return None
    try:
        date_str = date_str.replace(' GMT', '').replace(' +0000', '')
        return datetime.strptime(date_str, '%a, %d %b %Y %H:%M:%S')
    except Exception:
        return _parse_date(date_str)

def _clean_text(text: str) -> str:
  if not text:
      return text
  text = re.sub(r'<[^>]+>', '', text)
  import html
  text = html.unescape(text)
  unicode_replacements = {
      '\u2018': "'",
      '\u2019': "'",
      '\u201c': '"',
      '\u201d': '"',
      '\u2013': '-',
      '\u2014': '-',
      '\u2026': '...',
      '\u00a0': ' ',
      '\u00ae': '(R)',
      '\u2122': '(TM)',
  }
  for unicode_char, replacement in unicode_replacements.items():
      text = text.replace(unicode_char, replacement)
  text = text.encode('ascii', 'ignore').decode('ascii')
  text = ' '.join(text.split())
  return text

def _parse_date(date_str: str) -> datetime | None:
    if not date_str:
        return None
    patterns = [
        r'(\d{4}-\d{2}-\d{2})',
        r'(\d{1,2}/\d{1,2}/\d{4})',
        r'(\w+ \d{1,2}, \d{4})',
    ]
    for pattern in patterns:
        match = re.search(pattern, date_str)
        if match:
            try:
                date_part = match.group(1)
                for fmt in ['%Y-%m-%d', '%m/%d/%Y', '%B %d, %Y']:
                    try:
                        return datetime.strptime(date_part, fmt)
                    except ValueError:
                        continue
            except Exception:
                pass
    return None 