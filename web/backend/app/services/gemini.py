import os
import threading
import time
from google import genai
from google.genai import errors
from ..config import settings

class GeminiSafetyBlockedError(RuntimeError):
    pass


class _TokenBucket:
    """Thread-safe token bucket that caps Gemini calls per minute.

    Free-tier Gemini quotas are RPM-bound (typically ~15 RPM on the free plan).
    Bursting N parallel policies blows this quota and triggers 429s, whose
    exponential backoff (2s->4s->8s...) is far slower than simply pacing calls
    up-front. This limiter guarantees we never exceed the configured RPM, so the
    reactive retry path in ``generate_content_with_retry`` is only a safety net.
    """

    def __init__(self, rate_per_minute: float, burst: int):
        self._lock = threading.Lock()
        self._rate = (rate_per_minute / 60.0) if rate_per_minute > 0 else 0.0
        self._burst = float(max(1, burst))
        self._tokens = self._burst
        self._last = time.monotonic()

    def acquire(self) -> None:
        if self._rate <= 0:
            _record_gemini_call(0.0)
            return
        start = time.monotonic()
        while True:
            with self._lock:
                now = time.monotonic()
                # Refill tokens based on elapsed wall-clock time.
                self._tokens = min(self._burst, self._tokens + (now - self._last) * self._rate)
                self._last = now
                if self._tokens >= 1.0:
                    self._tokens -= 1.0
                    _record_gemini_call(time.monotonic() - start)
                    return
                need = 1.0 - self._tokens
                wait = need / self._rate
            time.sleep(min(wait, 1.0))


def _gemini_limiter() -> _TokenBucket:
    global _limiter
    if _limiter is None:
        rpm = float(os.getenv("GEMINI_RPM", "14") or "14")
        burst = int(os.getenv("GEMINI_BURST", "3") or "3")
        _limiter = _TokenBucket(rpm, burst)
    return _limiter


def _is_safety_block_error(error: Exception) -> bool:
    message = str(error)
    return any(token in message for token in [
        "HARM_CATEGORY_",
        "SAFETY",
        "PROHIBITED_CONTENT",
        "BLOCKLIST",
        "SPII",
    ])

_client: genai.Client | None = None
_limiter: "_TokenBucket | None" = None

# Observability (#4): counts every Gemini API call + total time spent waiting in
# the rate limiter, so GEMINI_RPM can be tuned to the account's real ceiling.
_stats_lock = threading.Lock()
_stats = {"calls": 0, "wait_seconds": 0.0}


def reset_gemini_stats() -> None:
    with _stats_lock:
        _stats["calls"] = 0
        _stats["wait_seconds"] = 0.0


def get_gemini_stats() -> dict:
    with _stats_lock:
        return {"calls": _stats["calls"], "wait_seconds": _stats["wait_seconds"]}


def _record_gemini_call(wait_seconds: float) -> None:
    with _stats_lock:
        _stats["calls"] += 1
        _stats["wait_seconds"] += wait_seconds

def get_gemini_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = settings.gemini_api_key or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not configured. Please set it in your .env file.")
        _client = genai.Client(api_key=api_key)
    return _client

def generate_content_with_retry(prompt: str, response_schema=None, temperature: float = 0.2, max_retries: int = 5) -> str:
    """Calls Gemini API with structured output and exponential backoff on rate limits."""
    _gemini_limiter().acquire()
    client = get_gemini_client()
    delay = 2.0
    
    for attempt in range(max_retries):
        try:
            safety_settings = [
                genai.types.SafetySetting(
                    category="HARM_CATEGORY_HATE_SPEECH",
                    threshold="BLOCK_ONLY_HIGH",
                ),
                genai.types.SafetySetting(
                    category="HARM_CATEGORY_HARASSMENT",
                    threshold="BLOCK_ONLY_HIGH",
                ),
                genai.types.SafetySetting(
                    category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold="BLOCK_ONLY_HIGH",
                ),
                genai.types.SafetySetting(
                    category="HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold="BLOCK_ONLY_HIGH",
                ),
            ]

            response = client.models.generate_content(
                model="gemini-3.5-flash-lite",
                contents=prompt,
                config=genai.types.GenerateContentConfig(
                    temperature=temperature,
                    safety_settings=safety_settings,
                    response_mime_type="application/json",
                )
            )
            return response.text
            
        except errors.APIError as e:
            if _is_safety_block_error(e):
                raise GeminiSafetyBlockedError(f"Gemini safety block: {e}") from e
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                print(f"Gemini API rate limit hit (429). Retrying in {delay}s... (Attempt {attempt+1}/{max_retries})")
                time.sleep(delay)
                delay *= 2.0
            else:
                print(f"Gemini API error: {e}")
                raise e
        except Exception as e:
            print(f"Unexpected error calling Gemini API: {e}")
            raise e
            
    raise Exception("Max retries exceeded for Gemini API call due to rate limits.")
