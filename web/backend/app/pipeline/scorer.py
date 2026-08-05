import time
from ..models.clause import AnalyzedClause, RiskLevel, ClauseCategory
from ..models.document import DocumentAnalysisResult, DocumentStatus

CATEGORY_MULTIPLIERS = {
    ClauseCategory.ARBITRATION_DISPUTE_RESOLUTION: 2.0,
    ClauseCategory.DATA_COLLECTION_SHARING: 2.0,
    ClauseCategory.PRIVACY_CONSENT_MECHANISMS: 2.0,
    ClauseCategory.LIABILITY_LIMITATION: 1.5,
    ClauseCategory.AUTO_RENEWAL: 1.5,
    ClauseCategory.UNILATERAL_MODIFICATION: 1.5,
    ClauseCategory.TERMINATION_CONDITIONS: 1.0,
    ClauseCategory.FEE_STRUCTURES_PENALTIES: 1.0,
    ClauseCategory.GOVERNING_LAW_VENUE: 0.8
}

def calculate_health_score(clauses: list[AnalyzedClause]) -> int:
    """Calculates document health score (0-100) based on weighted risk scores."""
    if not clauses:
        return 100
        
    weighted_risk_sum = 0.0
    # The absolute maximum possible risk score per clause is 3.0 (Risky weight) * 2.0 (Max multiplier)
    max_score_per_clause = 3.0 * 2.0
    max_possible_risk = len(clauses) * max_score_per_clause
    
    for c in clauses:
        # Weight based on risk level
        if c.risk_level == RiskLevel.RISKY:
            weight = 3.0
        elif c.risk_level == RiskLevel.CAUTIONARY:
            weight = 1.0
        else:
            weight = 0.0
            
        multiplier = CATEGORY_MULTIPLIERS.get(c.category, 1.0)
        weighted_risk_sum += weight * multiplier
        
    if max_possible_risk == 0:
        return 100
        
    score = 100.0 - ((weighted_risk_sum / max_possible_risk) * 100.0)
    return max(0, min(100, int(score)))

def generate_summary(health_score: int, clauses: list[AnalyzedClause]) -> str:
    """Generates an executive summary based on the analysis counts and score."""
    total = len(clauses)
    high_count = sum(1 for c in clauses if c.risk_level == RiskLevel.RISKY)
    med_count = sum(1 for c in clauses if c.risk_level == RiskLevel.CAUTIONARY)
    
    if health_score >= 85:
        verdict = "Excellent. This document is exceptionally fair, balanced, and user-friendly. Few to no unfavorable terms detected."
    elif health_score >= 65:
        verdict = "Balanced with caveats. This agreement is mostly standard but features a few cautionary sections to review carefully before signing."
    else:
        verdict = "Action required. This document is heavily one-sided, containing critical gotcha clauses that restrict your rights or expose you to unexpected fees."
        
    summary_parts = [
        verdict,
        f"We extracted and analyzed {total} clauses.",
        f"Identified {high_count} high-risk provisions and {med_count} cautionary provisions for your review."
    ]
    
    return " ".join(summary_parts)

def build_analysis_result(
    doc_id: str,
    filename: str,
    clauses: list[AnalyzedClause],
    start_time: float,
    doc_type: str = "custom"
) -> DocumentAnalysisResult:
    """Aggregates all clause analyses into the final DocumentAnalysisResult."""
    health_score = calculate_health_score(clauses)
    summary = generate_summary(health_score, clauses)
    
    # Category breakdown
    category_breakdown = {}
    for c in clauses:
        cat_str = c.category.value
        category_breakdown[cat_str] = category_breakdown.get(cat_str, 0) + 1
        
    # Top risks (High and Cautionary)
    top_risks = [c for c in clauses if c.risk_level in (RiskLevel.RISKY, RiskLevel.CAUTIONARY)]
    # Sort: Risky first, then higher confidence
    top_risks.sort(key=lambda x: (x.risk_level == RiskLevel.RISKY, x.confidence), reverse=True)
    top_risks = top_risks[:5]
    
    upload_date = time.strftime("%b %d, %Y")
    processing_time = time.time() - start_time
    
    return DocumentAnalysisResult(
        id=doc_id,
        status=DocumentStatus.DONE,
        filename=filename,
        document_type=doc_type,
        upload_date=upload_date,
        health_score=health_score,
        summary=summary,
        clauses=clauses,
        top_risks=top_risks,
        category_breakdown=category_breakdown,
        processing_time_seconds=round(processing_time, 2)
    )
