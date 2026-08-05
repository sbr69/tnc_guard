from .base import CamelModel

class ReferenceClause(CamelModel):
    id: str
    text: str
    category: str
    risk_label: str
    explanation: str
    source: str
    similarity_score: float | None = None
