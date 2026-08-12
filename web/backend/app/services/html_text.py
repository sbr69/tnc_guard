"""Shared HTML-to-text extraction for the RAG pipeline.

Single source of truth so discovery (which caches text for ``parse_url`` to
reuse) and ``parser.parse_url`` (which fresh-fetches on a cache miss) produce
byte-identical text. Drift between the two would silently break the cache
short-circuit in ``parse_url`` and re-introduce the "183k-char flattened nav"
class of bug.
"""
import re

from bs4 import BeautifulSoup

# One-line UI chrome that docs platforms (GitHub Docs, Docusaurus, GitBook)
# render inside the content tree rather than in <nav>/<aside>. Anchored to the
# whole line so legal prose is never matched.
_UI_NOISE_RE = re.compile(
    r"^(?:skip to (?:main )?content|collapse sidebar|expand sidebar|"
    r"toggle (?:navigation|sidebar)|back to top|edit this page|"
    r"on this page|table of contents)$",
    re.I,
)

_OUTER_CHROME = ("script", "style", "noscript")
_INNER_CHROME = ("nav", "header", "footer", "aside")


def extract_page_text(html: str) -> str:
    """Clean page text for the RAG pipeline.

    Selects the semantic main content region when present (``<main>`` /
    ``role=main`` / ``<article>``) so docs-platform sidebars rendered outside
    it are dropped entirely; strips ``nav/header/footer/aside`` as a backstop
    for chrome inside main; preserves newlines so the segmenter splits on
    paragraph boundaries instead of receiving one flattened string; and
    filters residual one-line UI chrome.
    """
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(_OUTER_CHROME):
        tag.extract()
    main = soup.find("main") or soup.find(attrs={"role": "main"}) or soup.find("article")
    target = main if main else soup
    for tag in target(_INNER_CHROME):
        tag.extract()
    text = target.get_text(separator="\n")
    kept = [s for s in (line.strip() for line in text.splitlines())
            if s and not _UI_NOISE_RE.match(s)]
    chunks = (phrase.strip() for line in kept for phrase in line.split("  "))
    return "\n".join(chunk for chunk in chunks if chunk)
