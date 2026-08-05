from enum import Enum
from .base import CamelModel

class RiskLevel(str, Enum):
    STANDARD = "standard"
    CAUTIONARY = "cautionary"
    RISKY = "risky"

class ClauseCategory(str, Enum):
    AUTO_RENEWAL = "auto_renewal"
    ARBITRATION_DISPUTE_RESOLUTION = "arbitration_dispute_resolution"
    UNILATERAL_MODIFICATION = "unilateral_modification"
    LIABILITY_LIMITATION = "liability_limitation"
    DATA_COLLECTION_SHARING = "data_collection_sharing"
    TERMINATION_CONDITIONS = "termination_conditions"
    FEE_STRUCTURES_PENALTIES = "fee_structures_penalties"
    GOVERNING_LAW_VENUE = "governing_law_venue"
    PRIVACY_CONSENT_MECHANISMS = "privacy_consent_mechanisms"

class ExtractedClause(CamelModel):
    clause_id: str
    text: str
    section_path: str
    order_index: int
    char_offset_start: int | None = None
    char_offset_end: int | None = None

class AnalyzedClause(CamelModel):
    id: str
    title: str
    category: ClauseCategory
    risk_level: RiskLevel
    confidence: float
    original_text: str
    simplified_text: str
    explanation: str
    rag_comparison: str
    compared_reference_ids: list[str] = []
    section_location: str
    rule_flags: list[str] = []
