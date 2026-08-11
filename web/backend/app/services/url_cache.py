"""Short-lived in-process cache of fetched page text keyed by URL.

Purpose: avoid the double-fetch introduced by site discovery. Discovery fetches
+ validates a candidate policy URL (e.g. a guessed /cookie path); the RAG
pipeline then re-fetches the SAME url inside ``parse_url``. By caching the
validated text here, ``parse_url`` can reuse it and skip the second HTTP round
trip.

The cache is intentionally tiny and time-bounded: it only exists to bridge the
gap between discovery and the pipeline within a single analysis request, so it
never changes analysis output (the text is identical to what a fresh fetch
would return).
"""
import threading
import time

_cache: dict[str, tuple[str, float]] = {}
_lock = threading.Lock()
_TTL_SECONDS = 300.0


def get(url: str) -> str | None:
    if not url:
        return None
    now = time.monotonic()
    with _lock:
        entry = _cache.get(url)
        if not entry:
            return None
        text, expires_at = entry
        if now > expires_at:
            _cache.pop(url, None)
            return None
        return text


def set(url: str, text: str) -> None:
    if not url or not text:
        return
    with _lock:
        # Bound growth: if the cache has grown large, drop expired entries.
        if len(_cache) > 256:
            _evict_expired(time.monotonic())
        _cache[url] = (text, time.monotonic() + _TTL_SECONDS)


def _evict_expired(now: float) -> None:
    for k in [k for k, (_, exp) in _cache.items() if now > exp]:
        _cache.pop(k, None)
