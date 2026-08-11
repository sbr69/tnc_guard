import time
import hashlib
import traceback
from concurrent.futures import ThreadPoolExecutor
from .parser import parse_document
from .segmenter import segment_document
from .rules import scan_clause_rules
from .retriever import batch_retrieve_references
from .reasoner import analyze_clause_batch
from .verifier import self_verify_risks
from .scorer import build_analysis_result
from ..services.db import (
    save_document_analysis,
    set_document_error,
    save_placeholder_document,
    get_done_doc_id_by_hash,
    get_document_analysis,
    mark_document_reuse,
)
from ..services.gemini import reset_gemini_stats, get_gemini_stats
from ..models.document import DocumentAnalysisResult, DocumentStatus

def run_analysis_pipeline(
    doc_id: str,
    filename: str,
    file_bytes: bytes | None = None,
    raw_text: str | None = None,
    url: str | None = None,
    doc_type: str = "custom"
) -> DocumentAnalysisResult:
    """Executes the full end-to-end RAG analysis pipeline and saves output to Postgres."""
    start_time = time.time()
    reset_gemini_stats()
    print(f"Starting analysis pipeline for document {doc_id} ('{filename}')...")

    try:
        # Stage 1: Parse Document
        print("Stage 1: Parsing document...")
        parsed_doc = parse_document(file_bytes=file_bytes, filename=filename, raw_text=raw_text, url=url)
        content_hash = hashlib.sha256(parsed_doc.raw_text.strip().encode("utf-8", "ignore")).hexdigest()
        save_placeholder_document(doc_id, filename, parsed_doc.raw_text, content_hash)

        # Stage 1.5: Content-hash dedup — reuse a prior analysis of identical text.
        # This is the biggest free-tier win: identical policy text = zero Gemini.
        existing_id = get_done_doc_id_by_hash(content_hash, doc_id)
        if existing_id:
            print(f"Content hash match found (existing doc {existing_id}). Reusing prior analysis — skipping pipeline.")
            src = get_document_analysis(existing_id)
            if src and src.status == DocumentStatus.DONE:
                mark_document_reuse(
                    doc_id,
                    existing_id,
                    src.health_score,
                    src.summary,
                    src.processing_time_seconds,
                    doc_type,
                )
                reused = get_document_analysis(doc_id)
                if reused:
                    print(f"Reused analysis for {doc_id} in {time.time() - start_time:.2f}s. Gemini calls: 0.")
                    return reused

        # Stage 2: Clause Segmentation
        print("Stage 2: Segmenting text into clauses...")
        extracted_clauses = segment_document(parsed_doc)

        if not extracted_clauses:
            raise Exception("No clauses could be extracted from the document.")

        print(f"Successfully extracted {len(extracted_clauses)} clauses.")

        # Stage 3a & 3b: Run in parallel (no data dependency)
        print("Stage 3: Running rule scan and vector retrieval in parallel...")
        with ThreadPoolExecutor(max_workers=2) as executor:
            rules_future = executor.submit(_run_rules_scan, extracted_clauses)
            references_future = executor.submit(batch_retrieve_references, extracted_clauses)

            rules_map = rules_future.result()
            references_map = references_future.result()

        # Stage 4: LLM Reasoning (batched)
        print("Stage 4: Running LLM reasoning...")
        analyzed_clauses = analyze_clause_batch(
            clauses=extracted_clauses,
            references_map=references_map,
            rules_map=rules_map,
            batch_size=20
        )

        # Stage 4.5: Self-verification
        print("Stage 4.5: Running self-verification on flagged risks...")
        verified_clauses = self_verify_risks(analyzed_clauses)

        # Stage 5: Score & Aggregate
        print("Stage 5: Calculating health scores and building report...")
        result = build_analysis_result(
            doc_id=doc_id,
            filename=filename,
            clauses=verified_clauses,
            start_time=start_time,
            doc_type=doc_type
        )

        # Save to DB
        print("Saving completed analysis report to Postgres database...")
        save_document_analysis(doc_id, result)
        stats = get_gemini_stats()
        print(f"Pipeline completed successfully in {result.processing_time_seconds}s! "
              f"Gemini calls: {stats['calls']}, paced-wait: {stats['wait_seconds']:.1f}s.")
        return result

    except Exception as e:
        error_msg = f"Pipeline execution failed: {str(e)}"
        print(error_msg)
        traceback.print_exc()
        set_document_error(doc_id, error_msg)
        raise e


def _run_rules_scan(clauses):
    rules_map = {}
    for c in clauses:
        rules_map[c.clause_id] = scan_clause_rules(c)
    return rules_map
