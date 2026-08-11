import os
import time
from google import genai
from google.genai import errors
from ..config import settings

class GeminiSafetyBlockedError(RuntimeError):
    pass


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
