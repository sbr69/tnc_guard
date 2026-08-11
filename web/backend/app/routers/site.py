from urllib.parse import urlparse
from fastapi import APIRouter, HTTPException
from ..models.base import CamelModel
from ..models.extension import ExtensionSiteReport
from ..services.discovery import discover_policy_urls, hostname_of
from ..services.site_analyzer import analyze_policies

router = APIRouter(prefix="/api/site", tags=["Site"])


class SiteAnalyzeRequest(CamelModel):
    site_url: str
    policy_urls: dict[str, str | None] = {}
    force_refresh: bool = False


@router.post("/analyze", response_model=ExtensionSiteReport)
async def analyze_site_url(req: SiteAnalyzeRequest):
    """Auto-discover and analyze all legal documents for a website.

    Accepts any URL belonging to a site (e.g. github.com or github.com/pricing).
    Targets the exact subdomain of the URL (website.vercel.app -> only
    website.vercel.app, never the root vercel.app). Performs hybrid discovery:
    scrape the homepage for policy links, then guess+validate common paths for
    any missing types. Missing optional documents are silently skipped.
    """
    site_url = (req.site_url or "").strip()
    if not site_url:
        raise HTTPException(status_code=400, detail="siteUrl is required.")

    # Accept bare domains / paths by normalizing to https://
    if not site_url.startswith(("http://", "https://")):
        site_url = "https://" + site_url

    try:
        parsed = urlparse(site_url)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid siteUrl.")

    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="Could not determine hostname from siteUrl.")

    # Discovery is strict-subdomain: provided policy URLs are trusted only when
    # they sit on the same hostname; missing types are found via homepage scrape
    # + path guessing.
    policy_urls = discover_policy_urls(
        hostname=hostname,
        site_url=site_url,
        provided=req.policy_urls,
    )

    if not any(policy_urls.values()):
        # Nothing found anywhere: return an empty (status=done, no policies)
        # report instead of erroring, so the UI can show a clean "no policies"
        # state rather than a stack trace.
        from ..services.site_analyzer import build_site_report
        return build_site_report(hostname, {})

    return await analyze_policies(hostname, policy_urls)
