"""Server-side legal document link discovery.

Hybrid approach (no external search APIs):
  Step 1: Trust client-provided same-entity URLs (extension content-script).
  Step 2: Scrape the homepage for policy links (Privacy / ToS / Cookie / EULA).
          Same-entity links (org + subdomains) are accepted by URL/anchor
          pattern. Cross-domain links are followed only when the anchor text
          explicitly names a policy and the fetched content validates.
  Step 3: Fetch sitemap.xml for any still-missing types (SPA-friendly).
  Step 4: Direct-URL fallback when nothing was found at all and the user URL
          itself looks like a policy page.
  Step 5: Probe common URL paths for still-missing types.

Entity resolution uses the Mozilla Public Suffix List so organisational
subdomains (docs.github.com for github.com) are crawled while multi-tenant
suffixes (myweb.vercel.app vs legal.vercel.app) stay isolated.
"""
import re
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin, urlparse

import requests
import tldextract
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

# Sitemap fallback bounds.
SITEMAP_MAX_BYTES = 512 * 1024
SITEMAP_MAX_CANDIDATES = 3
SITEMAP_MAX_CHILD_SITEMAPS = 2

# Cross-domain follows are gated by explicit anchor-text naming + content
# validation; this caps how many we chase per homepage scrape.
CROSS_DOMAIN_FOLLOW_LIMIT = 2

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

# Public Suffix List resolver. Bundled snapshot only (no network refresh) so
# cold starts stay fast and offline-safe.
_TLD = tldextract.TLDExtract(suffix_list_urls=())

_SITEMAP_LOC_RE = re.compile(r"<loc>\s*([^<]+?)\s*</loc>", re.I)


def hostname_of(url: str) -> str | None:
    try:
        return urlparse(url).hostname
    except Exception:
        return None


def _registered_domain(url: str) -> str | None:
    try:
        return _TLD(url).top_domain_under_public_suffix or None
    except Exception:
        return None


def _is_same_hostname(url: str, hostname: str) -> bool:
    h = hostname_of(url)
    return bool(h) and h.lower() == hostname.lower()


def _is_same_entity(url: str, hostname: str) -> bool:
    """True when ``url`` belongs to the same entity as ``hostname``.

    Org subdomains of an apex target are the same entity (docs.github.com for
    github.com). But a target that is *itself* a subdomain of a shared
    multi-tenant platform (myweb.vercel.app, user.github.io) is isolated by
    exact hostname so different tenants of the same platform are never crawled.

    Robust to PSL gaps: even when a platform suffix (.vercel.app) is unknown to
    the resolver, a subdomain target falls back to exact match instead of
    collapsing onto a shared registered domain. Leading ``www.`` is a non-tenant
    prefix.
    """
    target = _registered_domain(f"https://{hostname}/") if hostname else None
    if not target:
        return _is_same_hostname(url, hostname)
    norm = hostname[4:] if hostname.lower().startswith("www.") else hostname
    if norm == target:
        # Apex/org target: same registered domain is same entity.
        return _registered_domain(url) == target
    # Target is itself a subdomain (likely a multi-tenant host): isolate by
    # exact hostname to avoid cross-tenant crawling.
    return _is_same_hostname(url, hostname)


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
    """Clean page text for the RAG pipeline. Must mirror parser.parse_url's
    extraction so cached discovery text is identical to a fresh parse: strip
    site chrome (nav/header/footer/aside) and preserve newlines so the
    segmenter can split on paragraph boundaries instead of receiving one
    giant flattened string that explodes into hundreds of junk clauses."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "nav", "header", "footer", "aside"]):
        tag.extract()
    text = soup.get_text(separator="\n")
    lines = (line.strip() for line in text.splitlines())
    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
    return "\n".join(chunk for chunk in chunks if chunk)


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


def _classify_by_text(text: str) -> str | None:
    """Policy type implied by anchor text alone. Used for cross-domain follows
    where the URL path lives on a different registered domain and so is not
    trustworthy on its own."""
    if not text:
        return None
    for pt in POLICY_TYPES:
        if POLICY_TEXT_PATTERNS[pt].search(text):
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
    cross_follows = 0
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith(("javascript:", "mailto:", "tel:", "#")):
            continue
        text = a.get_text(" ", strip=True)
        try:
            resolved = urljoin(base, href)
        except Exception:
            continue

        if _is_same_entity(resolved, hostname):
            pt = _classify_link(resolved, text)
            if pt and not found[pt]:
                found[pt] = resolved
            continue

        # Cross-domain: only follow when the anchor text explicitly names a
        # policy we still need, the fetched content validates, and we're under
        # cap. Many companies host legal docs on a different registered domain
        # (e.g. OpenAI -> policies.google.com / notion.so).
        text_pt = _classify_by_text(text)
        if not text_pt or found[text_pt] or cross_follows >= CROSS_DOMAIN_FOLLOW_LIMIT:
            continue
        cand_html = _fetch(resolved)
        if not cand_html:
            continue
        cand_text = _extract_text(cand_html)
        if _looks_like_policy(cand_text, text_pt):
            cache_set(resolved, cand_text)
            found[text_pt] = resolved
            cross_follows += 1
    return found


def _match_sitemap_candidates(locs: list[str], missing: list[str], found: dict) -> dict:
    """Validate sitemap <loc> entries against still-missing policy types."""
    for pt in missing:
        if found[pt]:
            continue
        matched = 0
        for loc in locs:
            if matched >= SITEMAP_MAX_CANDIDATES:
                break
            if not POLICY_URL_PATTERNS[pt].search(loc):
                continue
            matched += 1
            cand_html = _fetch(loc)
            if not cand_html:
                continue
            cand_text = _extract_text(cand_html)
            if _looks_like_policy(cand_text, pt):
                cache_set(loc, cand_text)
                found[pt] = loc
                break
    return found


def _scrape_sitemap(hostname: str, found: dict) -> dict:
    """Fallback for SPAs: scan sitemap.xml for policy URLs the homepage scrape
    missed. Bounded by body size, candidate count per type, and one level of
    sitemap-index traversal."""
    missing = [pt for pt in POLICY_TYPES if not found[pt]]
    if not missing:
        return found
    for base in (f"https://{hostname}/sitemap.xml", f"https://{hostname}/sitemap_index.xml"):
        body = _fetch(base)
        if not body:
            continue
        if len(body) > SITEMAP_MAX_BYTES:
            body = body[:SITEMAP_MAX_BYTES]
        locs = _SITEMAP_LOC_RE.findall(body)
        child_locs = [l for l in locs if l.lower().endswith(".xml")]
        page_locs = [l for l in locs if not l.lower().endswith(".xml")]

        found = _match_sitemap_candidates(page_locs, missing, found)
        missing = [pt for pt in POLICY_TYPES if not found[pt]]
        if missing and child_locs:
            for child in child_locs[:SITEMAP_MAX_CHILD_SITEMAPS]:
                child_body = _fetch(child)
                if not child_body:
                    continue
                if len(child_body) > SITEMAP_MAX_BYTES:
                    child_body = child_body[:SITEMAP_MAX_BYTES]
                found = _match_sitemap_candidates(_SITEMAP_LOC_RE.findall(child_body), missing, found)
                missing = [pt for pt in POLICY_TYPES if not found[pt]]
                if not missing:
                    break
        if not any(not found[pt] for pt in POLICY_TYPES):
            return found
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
    """Discover policy URLs for a hostname.

    Entity resolution uses the Public Suffix List: organisational subdomains
    (docs.github.com for github.com) are crawled, multi-tenant suffixes
    (myweb.vercel.app vs legal.vercel.app) stay isolated.
    """
    found: dict[str, str | None] = {pt: None for pt in POLICY_TYPES}

    # 1. Trust client-provided same-entity URLs (extension content-script).
    if provided:
        for pt, url in provided.items():
            if url and _is_same_entity(url, hostname):
                found[pt] = url

    # 2. Scrape the homepage for policy links (+ bounded cross-domain follows).
    if any(v is None for v in found.values()):
        found = _scrape_homepage(hostname, found)

    # 3. Sitemap fallback for still-missing types (SPA-friendly).
    if any(v is None for v in found.values()):
        found = _scrape_sitemap(hostname, found)

    # 4. Direct-URL fallback: only when nothing was found at all, and only if the
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

    # 5. Probe common paths for still-missing types (probe types in parallel,
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
