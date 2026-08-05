from enum import Enum
from .base import CamelModel
from .clause import AnalyzedClause

class DocumentStatus(str, Enum):
    PROCESSING = "processing"
    DONE = "done"
    ERROR = "error"

class DocumentAnalysisResult(CamelModel):
    id: str
    status: DocumentStatus
    filename: str
    document_type: str = "custom"
    upload_date: str
    health_score: int | None = None
    summary: str | None = None
    clauses: list[AnalyzedClause] = []
    top_risks: list[AnalyzedClause] = []
    category_breakdown: dict[str, int] = {}
    processing_time_seconds: float | None = None
    error_message: str | None = None
    disclaimer: str = "This analysis is for informational purposes only and does not constitute legal advice. Always consult a qualified attorney before making legal decisions based on contract analysis."
