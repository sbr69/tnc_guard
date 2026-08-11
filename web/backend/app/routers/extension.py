from fastapi import APIRouter
from ..models.base import CamelModel
from ..models.extension import ExtensionSiteReport
from ..services.site_analyzer import analyze_policies

router = APIRouter(prefix="/api/extension", tags=["Extension"])


class AnalyzeRequest(CamelModel):
    domain: str
    policy_urls: dict[str, str | None]


@router.post("/analyze", response_model=ExtensionSiteReport)
async def analyze_site(req: AnalyzeRequest):
    """Legacy extension bridge: analyze the policy URLs supplied by the client.

    Kept for backward compatibility. New callers (extension + web app) should
    use /api/site/analyze, which auto-discovers missing policies server-side.
    """
    return await analyze_policies(req.domain, req.policy_urls)
