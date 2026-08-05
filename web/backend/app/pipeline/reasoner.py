import os
import json
from pydantic import BaseModel
from ..models.clause import ExtractedClause, AnalyzedClause, RiskLevel, ClauseCategory
from ..models.reference import ReferenceClause
from ..services.gemini import generate_content_with_retry

class LLMClauseAnalysisItem(BaseModel):
    clause_id: str
    category: ClauseCategory
    risk_level: RiskLevel
    confidence: float
    title: str
    plain_language: str
    explanation: str
    rag_comparison: str

class LLMClauseAnalysisBatchResponse(BaseModel):
    analyses: list[LLMClauseAnalysisItem]

def get_reasoning_prompt_template() -> str:
    path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prompts", "risk_reasoning_v1.txt")
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def analyze_clause_batch(
    clauses: list[ExtractedClause],
    references_map: dict[str, list[ReferenceClause]],
    rules_map: dict[str, list[str]],
    batch_size: int = 5
) -> list[AnalyzedClause]:
    """Batches clauses to analyze them in groups using a single Gemini call per batch."""
    analyzed_clauses = []
    template = get_reasoning_prompt_template()
    
    for i in range(0, len(clauses), batch_size):
        batch = clauses[i:i + batch_size]
        print(f"Running LLM analysis on batch {i // batch_size + 1} ({len(batch)} items)...")
        
        # Build batch prompt
        prompt_parts = [
            "You are a senior legal analyst. Analyze the following batch of clauses in a single run.",
            "Compare each clause against its retrieved database reference standards and rule flags.",
            f"You MUST return a JSON list containing analysis for each of these {len(batch)} clauses.",
            "\n=== BATCH CLAUSES ==="
        ]
        
        for c in batch:
            refs = references_map.get(c.clause_id, [])
            rule_flags = rules_map.get(c.clause_id, [])
            
            # Format references text
            refs_str = ""
            if not refs:
                refs_str = "No database matches above similarity threshold."
            else:
                for idx, r in enumerate(refs):
                    refs_str += f"\nReference {idx+1} [ID: {r.id}] (Risk: {r.risk_label}, Source: {r.source}):\n\"{r.text}\"\nWhy: {r.explanation}\n"
                    
            prompt_parts.append(f"""
Clause ID: {c.clause_id}
Original Text: "{c.text}"
Section Path: {c.section_path}
Rule Flags Matched: {', '.join(rule_flags) if rule_flags else 'None'}
Retrieved Reference Standards:
{refs_str}
--------------------------------------------------""")
            
        prompt_parts.append("\n=====================\n")
        prompt_parts.append("Generate structured JSON conforming to the requested schema. Ensure EVERY Clause ID in this batch is analyzed.")
        
        full_prompt = "\n".join(prompt_parts)
        
        try:
            # Call Gemini with batch schema
            json_output = generate_content_with_retry(
                full_prompt,
                response_schema=LLMClauseAnalysisBatchResponse,
                temperature=0.2
            )
            
            # Parse batch response
            data = json.loads(json_output)
            analyses_list = data.get("analyses", [])
            analyses_by_id = {item["clause_id"]: item for item in analyses_list if "clause_id" in item}
            
            # Match results back to original batch clauses
            for c in batch:
                analysis = analyses_by_id.get(c.clause_id)
                refs = references_map.get(c.clause_id, [])
                ref_ids = [r.id for r in refs]
                
                if analysis:
                    analyzed_clauses.append(AnalyzedClause(
                        id=c.clause_id,
                        title=analysis.get("title", "Legal provision"),
                        category=ClauseCategory(analysis.get("category", ClauseCategory.LIABILITY_LIMITATION.value)),
                        risk_level=RiskLevel(analysis.get("risk_level", RiskLevel.CAUTIONARY.value)),
                        confidence=float(analysis.get("confidence", 0.8)),
                        original_text=c.text,
                        simplified_text=analysis.get("plain_language", "No simplified translation generated."),
                        explanation=analysis.get("explanation", "Review recommended."),
                        rag_comparison=analysis.get("rag_comparison", "No comparison notes available."),
                        compared_reference_ids=ref_ids,
                        section_location=c.section_path,
                        rule_flags=rules_map.get(c.clause_id, [])
                    ))
                else:
                    # Fallback default analysis if LLM failed to include this ID in its response list
                    print(f"Warning: Clause {c.clause_id} was missing in LLM response batch. Generating fallback.")
                    fallback_level = RiskLevel.CAUTIONARY if rules_map.get(c.clause_id) else RiskLevel.STANDARD
                    analyzed_clauses.append(AnalyzedClause(
                        id=c.clause_id,
                        title="Agreement Provision",
                        category=ClauseCategory.LIABILITY_LIMITATION,
                        risk_level=fallback_level,
                        confidence=0.5,
                        original_text=c.text,
                        simplified_text="Please review the original legal text directly.",
                        explanation="This clause was skipped or could not be fully assessed by the pipeline.",
                        rag_comparison="No close reference matching standard found.",
                        compared_reference_ids=ref_ids,
                        section_location=c.section_path,
                        rule_flags=rules_map.get(c.clause_id, [])
                    ))
        except Exception as e:
            print(f"Batch analysis call failed: {e}. Generating default fallbacks for this batch.")
            for c in batch:
                analyzed_clauses.append(AnalyzedClause(
                    id=c.clause_id,
                    title="Agreement Provision",
                    category=ClauseCategory.LIABILITY_LIMITATION,
                    risk_level=RiskLevel.CAUTIONARY,
                    confidence=0.5,
                    original_text=c.text,
                    simplified_text="Analysis failed. Please review the original provision.",
                    explanation="An error occurred in the AI reasoning service.",
                    rag_comparison="Unable to match standards.",
                    compared_reference_ids=[r.id for r in references_map.get(c.clause_id, [])],
                    section_location=c.section_path,
                    rule_flags=rules_map.get(c.clause_id, [])
                ))
                
    return analyzed_clauses
