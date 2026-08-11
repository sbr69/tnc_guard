"""Server-side legal document link discovery.

Hybrid approach (no external search APIs):
  Step 1: Scrape the exact-subdomain homepage for policy links (Privacy / ToS / Cookie / EULA).
  Step 2: For any missing policy types, guess common URL paths and validate them.
  Direct-URL fallback: only when nothing was found at all, and only if the
  user-provided URL itself looks like a policy page.

Subdomain targeting is strict: only links on the same hostname as the target
are accepted (website.vercel.app -> website.vercel.app, never vercel.app).
"""
import re
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from .url_cache import get as cache_get, set as cache_set

POLICY_TYPES = ("privacy", "tos", "cookie", "eula")

POLICY_URL_PATTERNS = {
    "privacy": re.compile(r"/(privacy|data-policy|datapolicy|privacy-policy|privacypolicy|privacy-notice|privacy-statement)", re.I),
    "tos": re.compile(r"/(terms|tos|terms-of-service|termsofservice|terms-and-conditions|terms-of-use|legal/terms|legal/tos)", re.I),
    "cookie": re.compile(r"/(cookie|cookies|cookie-policy|cookiepolicy|cookie-notice)", re.I),
    "eula": re.compile(r"/(eula|license-agreement|licence-agreement|end-user-license|end_user_license|software-license|software-licence)", re.I),
}

POLICY_TEXT_PATTERNS = {
    "privacy": re.compile(r"privacy\s*(policy|notice|statement|rights)", re.I),
    "tos": re.compile(r"terms\s*(of\s*service|of\s*use|and\s*conditions)|terms\s*&\s*conditions|terms\s+of\s+service", re.I),
    "cookie": re.compile(r"cookie\s*(policy|notice|preferences|settings|statement)", re.I),
    "eula": re.compile(r"(end[ \-]?user\s*licen[cs]e|software\s*licen[cs]e|EULA)", re.I),
}

GUESS_PATHS = {
    "privacy": ["/privacy", "/privacy-policy", "/privacypolicy", "/privacy-notice", "/privacy-statement",
                "/legal/privacy", "/legal/privacy-policy", "/about/privacy", "/policies/privacy", "/policies/privacy-policy"],
    "tos": ["/terms", "/tos", "/terms-of-service", "/terms-of-use", "/terms-and-conditions", "/termsofservice",
            "/legal/terms", "/legal/terms-of-service", "/legal/terms-of-use", "/policies/terms"],
    "cookie": ["/cookie", "/cookies", "/cookie-policy", "/cookiepolicy", "/cookie-notice",
               "/legal/cookie", "/legal/cookies", "/policies/cookies", "/cookie-statement"],
    "eula": ["/eula", "/license-agreement", "/licence-agreement", "/end-user-license-agreement",
             "/software-license", "/software-licence", "/legal/eula", "/legal/license"],
}

VALIDATION_KEYWORDS = {
    "privacy": ["privacy", "personal information", "personal data", "data we collect",
                "information we collect", "your data", "information about you", "collect information"],
    "tos": ["terms", "agreement", "service", "conditions", "party", "license"],
    "cookie": ["cookie", "cookies"],
    "eula": ["licen", "end user", "end-user", "software", "agreement"],
}

MIN_POLICY_TEXT_LENGTH = 500
REQUEST_TIMEOUT = 12

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


def hostname_of(url: str) -> str | None:
    try:
        return urlparse(url).hostname
    except Exception:
        return None


def _is_same_hostname(url: str, hostname: str) -> bool:
    h = hostname_of(url)
    return bool(h) and h.lower() == hostname.lower()


def _fetch(url: str) -> str | None:
    """GET a URL and return its HTML text, or None on failure."""
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=REQUEST_TIMEOUT, allow_redirects=True)
        if resp.status_code >= 400 or not resp.text:
            return None
        return resp.text
    except Exception:
        return None


def _extract_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.extract()
    return re.sub(r"\s+", " ", soup.get_text(" ")).strip()


def _looks_like_policy(text: str, ptype: str) -> bool:
    if not text or len(text) < MIN_POLICY_TEXT_LENGTH:
        return False
    lower = text.lower()
    return any(kw in lower for kw in VALIDATION_KEYWORDS[ptype])


def _classify_link(href: str, text: str) -> str | None:
    """Return the policy type for a link, or None if it doesn't match."""
    for pt in POLICY_TYPES:
        if POLICY_URL_PATTERNS[pt].search(href) or (text and POLICY_TEXT_PATTERNS[pt].search(text)):
            return pt
    return None


def _scrape_homepage(hostname: str, found: dict) -> dict:
    base = f"https://{hostname}/"
    html = _fetch(base)
    if html is None:
        html = _fetch(f"http://{hostname}/")
    if html is None:
        return found

    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith(("javascript:", "mailto:", "tel:", "#")):
            continue
        text = a.get_text(" ", strip=True)
        try:
            resolved = urljoin(base, href)
        except Exception:
            continue
        if not _is_same_hostname(resolved, hostname):
            continue
        pt = _classify_link(resolved, text)
        if pt and not found[pt]:
            found[pt] = resolved
    return found


def _probe_guess(hostname: str, ptype: str) -> str | None:
    for path in GUESS_PATHS[ptype]:
        url = f"https://{hostname}{path}"
        html = _fetch(url)
        if html is None:
            continue
        text = _extract_text(html)
        if _looks_like_policy(text, ptype):
            # Cache the validated text so the RAG pipeline's parse_url can
            # reuse it instead of re-fetching the same URL (P0-1).
            cache_set(url, text)
            return url
    return None


def discover_policy_urls(
    hostname: str,
    site_url: str | None = None,
    provided: dict[str, str | None] | None = None,
) -> dict[str, str | None]:
    """Discover policy URLs for a hostname (strict subdomain targeting).

    Args:
        hostname: exact target hostname (e.g. website.vercel.app).
        site_url: the original URL the user pasted / active tab URL (used for
            the direct-URL fallback only).
        provided: client-discovered policy URLs (e.g. from the extension content
            script). Same-hostname entries are trusted.
    """
    found: dict[str, str | None] = {pt: None for pt in POLICY_TYPES}

    # 1. Trust provided same-hostname URLs (extension content-script discovery).
    if provided:
        for pt, url in provided.items():
            if url and _is_same_hostname(url, hostname):
                found[pt] = url

    # 2. Scrape the exact-subdomain homepage for missing policy links.
    if any(v is None for v in found.values()):
        found = _scrape_homepage(hostname, found)

    # 3. Direct-URL fallback: only when nothing was found at all, and only if the
    #    user-provided URL itself looks like a policy page.
    if all(v is None for v in found.values()) and site_url:
        pt = _classify_link(site_url, "")
        if pt:
            html = _fetch(site_url)
            if html:
                text = _extract_text(html)
                if _looks_like_policy(text, pt):
                    cache_set(site_url, text)
                    found[pt] = site_url

    # 4. Guess common paths for still-missing types (probe types in parallel,
    #    paths within a type sequentially, stopping at first valid match).
    missing = [pt for pt in POLICY_TYPES if not found[pt]]
    if missing:
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = {executor.submit(_probe_guess, hostname, pt): pt for pt in missing}
            for future in futures:
                pt = futures[future]
                try:
                    result = future.result()
                    if result:
                        found[pt] = result
                except Exception:
                    pass

    return found
