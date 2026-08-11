"""In-memory site-analysis job store (single backend instance).

Turns the site analysis into a non-blocking job so a long cold analysis
(~50s on the free tier) doesn't hold a single HTTP connection open for that
long. ``POST /api/site/analyze`` starts a job and returns 202 immediately (it
waits up to ~3s so fast/empty jobs return 200 in the same request); clients
poll ``GET /api/site/status?hostname=`` until 200.

State is process-local: a backend restart loses in-flight jobs, and the client
handles that by re-posting on a 404. The durable source of truth for completed
analyses is the worker KV cache + the content-hash dedup in the DB.
"""
import asyncio
import time

from .discovery import discover_policy_urls
from .site_analyzer import analyze_policies, build_site_report

# hostname -> job dict
_jobs: dict[str, dict] = {}
_lock = asyncio.Lock()
_DONE_TTL = 30 * 60  # keep completed/error jobs queryable for 30 min
_POST_WAIT_SECONDS = 3.0  # how long POST waits for a fast completion before 202


async def _run_job(hostname: str, site_url: str, provided, job: dict) -> None:
    try:
        policy_urls = await asyncio.to_thread(discover_policy_urls, hostname, site_url, provided)
        if not any(policy_urls.values()):
            report = build_site_report(hostname, {})
        else:
            report = await analyze_policies(hostname, policy_urls)
        job["report"] = report
        job["status"] = "done"
    except Exception as e:
        job["error"] = str(e)
        job["status"] = "error"
    finally:
        job["finished"] = time.time()


async def start_or_get_job(hostname: str, site_url: str, provided, force_refresh: bool = False) -> dict:
    """Return the job for ``hostname``, starting a new one if needed.

    With ``force_refresh`` the existing job (even if done) is replaced so a
    re-scan actually re-runs the pipeline.
    """
    start_new = False
    async with _lock:
        job = _jobs.get(hostname)
        now = time.time()
        if job and job["status"] in ("done", "error") and now - (job.get("finished") or 0) > _DONE_TTL:
            job = None
        if job and not force_refresh and job["status"] in ("processing", "done"):
            return job
        # No job, previously errored, or force_refresh -> (re)start.
        if job and job.get("task") and not job["task"].done():
            job["task"].cancel()
        job = {
            "status": "processing",
            "report": None,
            "error": None,
            "started": now,
            "finished": None,
            "task": None,
        }
        _jobs[hostname] = job
        job["task"] = asyncio.create_task(_run_job(hostname, site_url, provided, job))
        start_new = True
    return job


async def await_job_briefly(job: dict, timeout: float = _POST_WAIT_SECONDS) -> None:
    """Wait up to ``timeout`` for the job to finish (used by POST for fast hits).

    Raises asyncio.TimeoutError if still running (the task is NOT cancelled —
    it keeps running in the background). Re-raises if the task itself failed.
    """
    task = job.get("task")
    if task is None:
        return
    await asyncio.wait_for(asyncio.shield(task), timeout=timeout)


def get_job(hostname: str) -> dict | None:
    return _jobs.get(hostname)
