"""Shared orchestration for site-level (multi-policy) analysis.

Used by both the extension bridge endpoint (/api/extension/analyze) and the
site-discovery endpoint (/api/site/analyze) so the scoring logic stays in one
place.
"""
import asyncio
import time
import uuid

from ..models.clause import RiskLevel
from ..models.extension import ExtensionSiteReport, PolicySummary, RiskFlag
from ..pipeline import run_analysis_pipeline
from .url_cache import set as cache_set

POLICY_WEIGHTS = {"privacy": 3.0, "tos": 2.5, "cookie": 1.5, "eula": 1.0}


async def analyze_single_policy(domain: str, policy_type: str, url: str):
    """Run the full RAG pipeline for a single policy URL. Returns None on failure."""
    try:
        doc_id = str(uuid.uuid4())
        filename = f"{domain}_{policy_type}"
        return await asyncio.to_thread(
            run_analysis_pipeline,
            doc_id=doc_id,
            filename=filename,
            url=url,
            doc_type=policy_type,
        )
    except Exception as e:
        print(f"Failed analyzing {policy_type}: {e}")
        return None


def build_site_report(domain: str, results: dict[str, object]) -> ExtensionSiteReport:
    """Aggregate per-policy pipeline results into a site report.

    ``results`` maps policy type -> DocumentAnalysisResult | None. Policies that
    are missing or failed are simply omitted (no "Not Found" placeholders).
    """
    policies: dict[str, PolicySummary] = {}
    all_top_risks = []
    weighted_sum = 0.0
    total_weight = 0.0

    for pt, result in results.items():
        if not result:
            continue
        score = (getattr(result, "health_score", 0) or 0) / 10.0
        weight = POLICY_WEIGHTS.get(pt, 1.0)
        weighted_sum += score * weight
        total_weight += weight

        flags = [c.title for c in getattr(result, "top_risks", [])]
        all_top_risks.extend(getattr(result, "top_risks", []))

        policies[pt] = PolicySummary(
            type=pt,
            title=pt.upper(),
            score=round(score, 1),
            risk_flags=flags,
            clause_count=len(getattr(result, "clauses", []) or []),
            document_id=getattr(result, "id", ""),
        )

    overall_score = round(weighted_sum / total_weight, 1) if total_weight > 0 else 0.0

    all_top_risks.sort(
        key=lambda x: (getattr(x, "risk_level", None) == RiskLevel.RISKY, getattr(x, "confidence", 0)),
        reverse=True,
    )
    top_risk_flags = [
        RiskFlag(
            label=c.title,
            severity="high" if getattr(c, "risk_level", None) == RiskLevel.RISKY else "medium",
        )
        for c in all_top_risks[:5]
    ]

    return ExtensionSiteReport(
        domain=domain,
        site_name=domain,
        overall_score=overall_score,
        scan_date=time.strftime("%b %d, %Y"),
        status="done",
        policies=policies,
        top_risk_flags=top_risk_flags,
    )


async def analyze_policies(
    domain: str,
    policy_urls: dict[str, str | None],
    policy_texts: dict[str, str | None] | None = None,
) -> ExtensionSiteReport:
    """Run the pipeline for every provided policy URL in parallel and build the report.

    ``policy_texts`` (e.g. extension-extracted DOM text for client-rendered
    SPAs) is pre-seeded into the URL cache so ``parse_url`` reuses it instead
    of fetching static HTML that would be empty for a SPA.
    """
    if policy_texts:
        for pt, text in policy_texts.items():
            url = policy_urls.get(pt)
            if url and text:
                cache_set(url, text)
    tasks = {pt: analyze_single_policy(domain, pt, url) for pt, url in policy_urls.items() if url}
    results: dict[str, object] = {}
    if tasks:
        completed = await asyncio.gather(*tasks.values())
        for pt, res in zip(tasks.keys(), completed):
            results[pt] = res
    return build_site_report(domain, results)
