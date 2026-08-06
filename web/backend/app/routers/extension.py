import uuid
import time
import asyncio
from fastapi import APIRouter
from ..models.base import CamelModel
from ..pipeline import run_analysis_pipeline
from ..models.extension import ExtensionSiteReport, PolicySummary, RiskFlag
from ..models.clause import RiskLevel

router = APIRouter(prefix="/api/extension", tags=["Extension"])

class AnalyzeRequest(CamelModel):
    domain: str
    policy_urls: dict[str, str | None]

async def analyze_single_policy(domain: str, policy_type: str, url: str):
    try:
        doc_id = str(uuid.uuid4())
        filename = f"{domain}_{policy_type}"
        return await asyncio.to_thread(
            run_analysis_pipeline,
            doc_id=doc_id,
            filename=filename,
            url=url,
            doc_type=policy_type
        )
    except Exception as e:
        print(f"Failed analyzing {policy_type}: {e}")
        return None

@router.post("/analyze", response_model=ExtensionSiteReport)
async def analyze_site(req: AnalyzeRequest):
    tasks = {}
    for pt, url in req.policy_urls.items():
        if url:
            tasks[pt] = analyze_single_policy(req.domain, pt, url)
            
    results = {}
    if tasks:
        completed = await asyncio.gather(*tasks.values())
        for pt, res in zip(tasks.keys(), completed):
            results[pt] = res
            
    policies = {}
    all_top_risks = []
    
    weights = {"privacy": 3.0, "tos": 2.5, "cookie": 1.5, "eula": 1.0}
    weighted_sum = 0.0
    total_weight = 0.0
    
    for pt, result in results.items():
        if result:
            score = (result.health_score or 0) / 10.0
            
            w = weights.get(pt, 1.0)
            weighted_sum += score * w
            total_weight += w
            
            flags = [c.title for c in result.top_risks]
            all_top_risks.extend(result.top_risks)
            
            policies[pt] = PolicySummary(
                type=pt,
                title=pt.upper(),
                score=round(score, 1),
                risk_flags=flags,
                clause_count=len(result.clauses),
                document_id=result.id
            )
            
    overall_score = round(weighted_sum / total_weight, 1) if total_weight > 0 else 0.0
    
    all_top_risks.sort(key=lambda x: (x.risk_level == RiskLevel.RISKY, x.confidence), reverse=True)
    
    top_risk_flags = []
    for c in all_top_risks[:5]:
        top_risk_flags.append(RiskFlag(
            label=c.title,
            severity="high" if c.risk_level == RiskLevel.RISKY else "medium"
        ))
        
    scan_date = time.strftime("%b %d, %Y")
    
    return ExtensionSiteReport(
        domain=req.domain,
        site_name=req.domain,
        overall_score=overall_score,
        scan_date=scan_date,
        status="done",
        policies=policies,
        top_risk_flags=top_risk_flags
    )
