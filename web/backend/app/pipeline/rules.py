import re
from ..models.clause import ExtractedClause

RULES = {
    "forced_arbitration": re.compile(r"binding arbitration|waive.*jury|class action waiver", re.IGNORECASE),
    "auto_renewal": re.compile(r"auto.?renew|automatically renew|renewal term", re.IGNORECASE),
    "unilateral_modification": re.compile(r"sole discretion|without notice|at any time.*without|right to modify.*without", re.IGNORECASE),
    "data_sharing_selling": re.compile(r"sell.*data|share.*third.?party|data broker|monetize.*user", re.IGNORECASE),
    "excessive_liability_limitation": re.compile(r"under no circumstances.*liable|maximum.*aggregate.*liability.*\$\d+|waive.*right", re.IGNORECASE),
    "excessive_penalties": re.compile(r"per day.*late|daily.*penalty|\d+%.*per.*day", re.IGNORECASE),
    "landlord_unannounced_entry": re.compile(r"without.*notice.*enter|at any hour|any time.*premises", re.IGNORECASE)
}

def scan_clause_rules(clause: ExtractedClause) -> list[str]:
    """Runs keyword patterns against the clause and returns list of triggered rule names."""
    triggered = []
    for rule_name, pattern in RULES.items():
        if pattern.search(clause.text):
            triggered.append(rule_name)
    return triggered
