from urllib.parse import urlparse
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from ..models.base import CamelModel
from ..models.extension import ExtensionSiteReport
from ..services.site_analyzer import build_site_report
from ..services.site_jobs import start_or_get_job, await_job_briefly, get_job

router = APIRouter(prefix="/api/site", tags=["Site"])


class SiteAnalyzeRequest(CamelModel):
    site_url: str
    policy_urls: dict[str, str | None] = {}
    policy_texts: dict[str, str | None] = {}
    force_refresh: bool = False


def _report_response(report, status_code: int = 200) -> JSONResponse:
    return JSONResponse(report.model_dump(by_alias=True), status_code=status_code)


@router.post("/analyze")
async def analyze_site_url(req: SiteAnalyzeRequest):
    """Start (or resume) analysis for a site. Returns 200 if the job finishes
    quickly (cache hit / empty / content-hash reuse), otherwise 202 and the
    client polls GET /api/site/status?hostname=."""
    site_url = (req.site_url or "").strip()
    if not site_url:
        raise HTTPException(status_code=400, detail="siteUrl is required.")

    if not site_url.startswith(("http://", "https://")):
        site_url = "https://" + site_url

    try:
        parsed = urlparse(site_url)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid siteUrl.")

    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="Could not determine hostname from siteUrl.")

    job = await start_or_get_job(hostname, site_url, req.policy_urls, req.policy_texts, req.force_refresh)

    # Already done (cached in-process).
    if job["status"] == "done" and job["report"] is not None:
        return _report_response(job["report"])

    # Wait briefly so fast jobs return 200 in the same request. A timeout here
    # just means "still processing" -> fall through to the 202 below.
    try:
        await await_job_briefly(job)
    except TimeoutError:
        pass
    except Exception as e:
        return JSONResponse({"error": str(e) or "Analysis failed."}, status_code=500)

    if job["status"] == "done" and job["report"] is not None:
        return _report_response(job["report"])
    if job["status"] == "error":
        return JSONResponse({"error": job.get("error") or "Analysis failed."}, status_code=500)
    return JSONResponse({"hostname": hostname, "status": "processing"}, status_code=202)


@router.get("/status")
async def site_status(hostname: str):
    """Poll the in-progress site analysis. 200 + report when done, 202 while
    processing, 404 if no job exists (client should re-POST), 500 on error."""
    job = get_job(hostname)
    if not job:
        raise HTTPException(status_code=404, detail="No analysis in progress for this hostname.")
    if job["status"] == "done" and job["report"] is not None:
        return _report_response(job["report"])
    if job["status"] == "error":
        raise HTTPException(status_code=500, detail=job.get("error") or "Analysis failed.")
    return JSONResponse({"hostname": hostname, "status": "processing"}, status_code=202)
