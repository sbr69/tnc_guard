import time
import traceback
from .parser import parse_document
from .segmenter import segment_document
from .rules import scan_clause_rules
from .retriever import batch_retrieve_references
from .reasoner import analyze_clause_batch
from .scorer import build_analysis_result
from ..services.db import save_document_analysis, set_document_error
from ..models.document import DocumentAnalysisResult

def run_analysis_pipeline(
    doc_id: str,
    filename: str,
    file_bytes: bytes | None = None,
    raw_text: str | None = None,
    doc_type: str = "custom"
) -> DocumentAnalysisResult:
    """Executes the full end-to-end RAG analysis pipeline and saves output to Postgres."""
    start_time = time.time()
    print(f"Starting analysis pipeline for document {doc_id} ('{filename}')...")
    
    try:
        # Stage 1: Parse Document
        print("Stage 1: Parsing document...")
        parsed_doc = parse_document(file_bytes=file_bytes, filename=filename, raw_text=raw_text)
        
        # Stage 2: Clause Segmentation
        print("Stage 2: Segmenting text into clauses...")
        extracted_clauses = segment_document(parsed_doc)
        
        if not extracted_clauses:
            raise Exception("No clauses could be extracted from the document.")
            
        print(f"Successfully extracted {len(extracted_clauses)} clauses.")
        
        # Stage 3a: Parallel Rule-Based Red-Flag Scan
        print("Stage 3a: Running deterministic red-flag keyword scan...")
        rules_map = {}
        for c in extracted_clauses:
            rules_map[c.clause_id] = scan_clause_rules(c)
            
        # Stage 3b: Parallel pgvector similarity search
        print("Stage 3b: Querying database vector standards (RAG)...")
        references_map = batch_retrieve_references(extracted_clauses)
        
        # Stage 4: LLM Reasoning (batched)
        print("Stage 4: Running LLM reasoning...")
        analyzed_clauses = analyze_clause_batch(
            clauses=extracted_clauses,
            references_map=references_map,
            rules_map=rules_map,
            batch_size=5  # batch size of 5 to respect rate limits
        )
        
        # Stage 5: Score & Aggregate
        print("Stage 5: Calculating health scores and building report...")
        result = build_analysis_result(
            doc_id=doc_id,
            filename=filename,
            clauses=analyzed_clauses,
            start_time=start_time,
            doc_type=doc_type
        )
        
        # Save to DB
        print("Saving completed analysis report to Postgres database...")
        save_document_analysis(doc_id, result)
        print(f"Pipeline completed successfully in {result.processing_time_seconds}s!")
        return result
        
    except Exception as e:
        error_msg = f"Pipeline execution failed: {str(e)}"
        print(error_msg)
        traceback.print_exc()
        set_document_error(doc_id, error_msg)
        raise e
