import json
import os

from pydantic import BaseModel

from ..models.clause import AnalyzedClause, ClauseCategory, ExtractedClause, RiskLevel
from ..models.reference import ReferenceClause
from ..services.gemini import GeminiSafetyBlockedError, generate_content_with_retry


class LLMClauseAnalysisItem(BaseModel):
    clause_id: str
    risk_level: RiskLevel
    confidence: float
    title: str
    plain_language: str
    explanation: str
    rag_comparison: str
    category: ClauseCategory = ClauseCategory.LIABILITY_LIMITATION


class LLMClauseAnalysisBatchResponse(BaseModel):
    analyses: list[LLMClauseAnalysisItem]


def get_reasoning_prompt_template() -> str:
    path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prompts", "risk_reasoning_v1.txt")
    with open(path, "r", encoding="utf-8") as file_handle:
        return file_handle.read()


def analyze_clause_batch(
    clauses: list[ExtractedClause],
    references_map: dict[str, list[ReferenceClause]],
    rules_map: dict[str, list[str]],
    batch_size: int = 20,
) -> list[AnalyzedClause]:
    analyzed_clauses: list[AnalyzedClause] = []
    template = get_reasoning_prompt_template()

    for start_index in range(0, len(clauses), batch_size):
        batch = clauses[start_index:start_index + batch_size]
        print(f"Running LLM analysis on batch {start_index // batch_size + 1} ({len(batch)} items)...")

        prompt_parts = [
            template,
            "You are a senior legal analyst. Analyze the following batch of clauses in a single run.",
            "Compare each clause against its retrieved database reference standards and rule flags.",
            f"You MUST return JSON with analyses for each of these {len(batch)} clauses.",
            "\n=== BATCH CLAUSES ===",
        ]

        for clause in batch:
            refs = references_map.get(clause.clause_id, [])
            rule_flags = rules_map.get(clause.clause_id, [])

            if not refs:
                refs_str = "No database matches above similarity threshold."
            else:
                refs_str = ""
                for idx, reference in enumerate(refs):
                    refs_str += (
                        f"\nReference {idx + 1} [ID: {reference.id}] "
                        f"(Risk: {reference.risk_label}, Source: {reference.source}):\n"
                        f'"{reference.text}"\nWhy: {reference.explanation}\n'
                    )

            prompt_parts.append(
                f"""
Clause ID: {clause.clause_id}
Original Text: "{clause.text}"
Section Path: {clause.section_path}
Rule Flags Matched: {', '.join(rule_flags) if rule_flags else 'None'}
Retrieved Reference Standards:
{refs_str}
--------------------------------------------------"""
            )

        prompt_parts.append("\n=====================\n")
        prompt_parts.append(
            "Generate structured JSON with a single root key 'analyses' containing an array of objects. "
            "Ensure EVERY Clause ID in this batch is analyzed. Format each object exactly like this:\n"
            "{\n"
            "  \"clause_id\": \"(the exact ID)\",\n"
            "  \"risk_level\": \"standard\", // or \"cautionary\", or \"risky\"\n"
            "  \"confidence\": 0.9,\n"
            "  \"title\": \"Short Title\",\n"
            "  \"plain_language\": \"Simplified explanation\",\n"
            "  \"explanation\": \"Why it matters\",\n"
            "  \"rag_comparison\": \"Comparison notes\",\n"
            "  \"category\": \"liability_limitation\"\n"
            "}"
        )

        full_prompt = "\n".join(prompt_parts)

        try:
            json_output = generate_content_with_retry(
                full_prompt,
                temperature=0.2,
            )

            raw_output = json_output.strip()
            if raw_output.startswith("```json"):
                raw_output = raw_output[7:]
            elif raw_output.startswith("```"):
                raw_output = raw_output[3:]
            if raw_output.endswith("```"):
                raw_output = raw_output[:-3]
            raw_output = raw_output.strip()

            try:
                data = json.loads(raw_output)
            except Exception:
                import re
                match = re.search(r'(\{.*\}|\[.*\])', raw_output, re.DOTALL)
                if match:
                    data = json.loads(match.group(1))
                else:
                    raise

            if isinstance(data, list):
                analyses_list = data
            else:
                analyses_list = data.get("analyses", [])

            analyses_by_id = {
                item["clause_id"]: item
                for item in analyses_list
                if isinstance(item, dict) and "clause_id" in item
            }

            for clause in batch:
                refs = references_map.get(clause.clause_id, [])
                ref_ids = [reference.id for reference in refs]
                analysis = analyses_by_id.get(clause.clause_id)

                if analysis:
                    analyzed_clauses.append(
                        AnalyzedClause(
                            id=clause.clause_id,
                            title=analysis.get("title", "Agreement Provision"),
                            category=ClauseCategory(analysis.get("category", ClauseCategory.LIABILITY_LIMITATION.value)),
                            risk_level=RiskLevel(analysis.get("risk_level", RiskLevel.CAUTIONARY.value)),
                            confidence=float(analysis.get("confidence", 0.8)),
                            original_text=clause.text,
                            simplified_text=analysis.get("plain_language", "No simplified translation generated."),
                            explanation=analysis.get("explanation", "Review recommended."),
                            rag_comparison=analysis.get("rag_comparison", "No comparison notes available."),
                            compared_reference_ids=ref_ids,
                            section_location=clause.section_path,
                            rule_flags=rules_map.get(clause.clause_id, []),
                        )
                    )
                else:
                    print(f"Warning: Clause {clause.clause_id} was missing in LLM response batch. Generating fallback.")
                    analyzed_clauses.append(
                        AnalyzedClause(
                            id=clause.clause_id,
                            title="Agreement Provision",
                            category=ClauseCategory.LIABILITY_LIMITATION,
                            risk_level=RiskLevel.CAUTIONARY if rules_map.get(clause.clause_id) else RiskLevel.STANDARD,
                            confidence=0.5,
                            original_text=clause.text,
                            simplified_text="Please review the original legal text directly.",
                            explanation="This clause was skipped or could not be fully assessed by the pipeline.",
                            rag_comparison="No close reference matching standard found.",
                            compared_reference_ids=ref_ids,
                            section_location=clause.section_path,
                            rule_flags=rules_map.get(clause.clause_id, []),
                        )
                    )
        except GeminiSafetyBlockedError as error:
            print(f"Batch analysis blocked by Gemini safety filters: {error}. Generating fallback analyses.")
            for clause in batch:
                analyzed_clauses.append(
                    AnalyzedClause(
                        id=clause.clause_id,
                        title="Agreement Provision",
                        category=ClauseCategory.LIABILITY_LIMITATION,
                        risk_level=RiskLevel.CAUTIONARY,
                        confidence=0.5,
                        original_text=clause.text,
                        simplified_text="Analysis failed. Please review the original provision.",
                        explanation="The AI reasoning service blocked this clause for safety reasons.",
                        rag_comparison="Unable to match standards.",
                        compared_reference_ids=[reference.id for reference in references_map.get(clause.clause_id, [])],
                        section_location=clause.section_path,
                        rule_flags=rules_map.get(clause.clause_id, []),
                    )
                )
        except Exception as error:
            print(f"Batch analysis call failed: {error}. Generating default fallbacks for this batch.")
            for clause in batch:
                analyzed_clauses.append(
                    AnalyzedClause(
                        id=clause.clause_id,
                        title="Agreement Provision",
                        category=ClauseCategory.LIABILITY_LIMITATION,
                        risk_level=RiskLevel.CAUTIONARY,
                        confidence=0.5,
                        original_text=clause.text,
                        simplified_text="Analysis failed. Please review the original provision.",
                        explanation=f"Error in reasoning service: {error}",
                        rag_comparison="Unable to match standards.",
                        compared_reference_ids=[reference.id for reference in references_map.get(clause.clause_id, [])],
                        section_location=clause.section_path,
                        rule_flags=rules_map.get(clause.clause_id, []),
                    )
                )

    return analyzed_clauses
