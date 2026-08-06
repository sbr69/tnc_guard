from .base import CamelModel

class PolicySummary(CamelModel):
    type: str
    title: str
    score: float
    risk_flags: list[str]
    clause_count: int
    document_id: str

class RiskFlag(CamelModel):
    label: str
    severity: str

class ExtensionSiteReport(CamelModel):
    domain: str
    site_name: str
    overall_score: float
    scan_date: str
    status: str
    policies: dict[str, PolicySummary]
    top_risk_flags: list[RiskFlag]
