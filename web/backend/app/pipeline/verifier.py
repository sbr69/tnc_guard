import json
from ..models.clause import AnalyzedClause, RiskLevel
from ..services.gemini import generate_content_with_retry

def self_verify_risks(clauses: list[AnalyzedClause]) -> list[AnalyzedClause]:
    """Filters hallucinated risks using a second LLM pass."""
    flagged_clauses = [c for c in clauses if c.risk_level in (RiskLevel.RISKY, RiskLevel.CAUTIONARY)]
    if not flagged_clauses:
        return clauses

    print(f"Stage 4.5: Verifying {len(flagged_clauses)} flagged clauses...")
    
    prompt_parts = [
        "You are a strict legal document fact-checker. Verify each flagged risk below.",
        "1. Check if the original text supports the assigned risk_level.",
        "2. If unsupported or hallucinated, reject it.",
        "Output JSON like: { \"results\": [ { \"id\": \"<id>\", \"action\": \"CONFIRMED\"|\"DOWNGRADE\"|\"REJECT\", \"corrected_risk\": \"<level>\" } ] }",
        "=== CLAUSES ==="
    ]
    
    for c in flagged_clauses:
        prompt_parts.append(
            f"ID: {c.id}\nOriginal Text: \"{c.original_text}\"\n"
            f"Assigned Risk: {c.risk_level}\nExplanation: {c.explanation}\n---"
        )
        
    full_prompt = "\n".join(prompt_parts)
    
    try:
        json_output = generate_content_with_retry(full_prompt, temperature=0.1)
        
        raw_output = json_output.strip()
        if raw_output.startswith("```json"):
            raw_output = raw_output[7:]
        elif raw_output.startswith("```"):
            raw_output = raw_output[3:]
        if raw_output.endswith("```"):
            raw_output = raw_output[:-3]
            
        data = json.loads(raw_output.strip())
        results = data.get("results", [])
        
        verification_map = {item["id"]: item for item in results}
        
        for c in clauses:
            if c.risk_level in (RiskLevel.RISKY, RiskLevel.CAUTIONARY):
                result = verification_map.get(c.id)
                if result:
                    action = result.get("action", "CONFIRMED")
                    if action == "REJECT":
                        print(f"Verifier rejected risk for clause {c.id}")
                        c.risk_level = RiskLevel.STANDARD
                        c.confidence = min(0.3, c.confidence)
                    elif action == "DOWNGRADE":
                        corrected = result.get("corrected_risk", "").lower()
                        print(f"Verifier downgraded risk for clause {c.id} to {corrected}")
                        if corrected in ["cautionary", "standard", "risky"]:
                            c.risk_level = RiskLevel(corrected)
                            
    except Exception as e:
        print(f"Self-verification failed, skipping: {e}")
        
    return clauses
