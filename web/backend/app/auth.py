import secrets

from fastapi import Header, HTTPException, status

from .config import settings


def verify_worker_token(x_worker_token: str | None = Header(default=None)) -> None:
    """Reject any request that does not carry the shared worker secret.

    The Cloudflare Worker is the only legitimate caller of the site/documents
    routers (it rate-limits + caches in front of them). Browsers reach the
    backend indirectly through the worker, so a direct hit on these routes is
    an abuse attempt (e.g. burning the Gemini quota at the source).

    Fail-closed: if WORKER_SHARED_SECRET is not configured on the backend, every
    protected request is rejected (503) rather than silently allowed. Timing-safe
    comparison avoids leaking the expected value via a side channel.
    """
    expected = settings.worker_shared_secret
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="WORKER_SHARED_SECRET is not configured on the backend.",
        )
    if x_worker_token is None or not secrets.compare_digest(x_worker_token, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing worker token.",
        )
