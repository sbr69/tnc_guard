import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from ..config import settings
from ..models.reference import ReferenceClause
from ..models.clause import AnalyzedClause, RiskLevel, ClauseCategory
from ..models.document import DocumentAnalysisResult, DocumentStatus

def get_db_connection():
    database_url = settings.database_url or os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL is not configured. Please set it in your .env file.")
    return psycopg2.connect(database_url)

def retrieve_similar_reference_clauses(embedding: list[float], limit: int = 5, threshold: float = 0.45) -> list[ReferenceClause]:
    """Queries Supabase Postgres using pgvector to return top-k matches above similarity threshold."""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Cosine distance operator is <=>
        # Cosine similarity is 1 - (embedding <=> query_vector)
        query = """
            SELECT id, text, category, risk_label, explanation, source,
                   (1 - (embedding <=> %s::vector)) as similarity
            FROM reference_clauses
            WHERE (1 - (embedding <=> %s::vector)) >= %s
            ORDER BY embedding <=> %s::vector
            LIMIT %s;
        """
        cursor.execute(query, (embedding, embedding, threshold, embedding, limit))
        rows = cursor.fetchall()
        
        matches = []
        for r in rows:
            matches.append(ReferenceClause(
                id=str(r['id']),
                text=r['text'],
                category=r['category'],
                risk_label=r['risk_label'],
                explanation=r['explanation'],
                source=r['source'],
                similarity_score=float(r['similarity'])
            ))
        return matches
    except Exception as e:
        print(f"Error querying pgvector: {e}")
        return []
    finally:
        cursor.close()
        conn.close()

def save_placeholder_document(doc_id: str, filename: str, raw_text: str) -> None:
    """Inserts a document record with status = 'processing'."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO documents (id, filename, raw_text, status)
            VALUES (%s, %s, %s, 'processing')
        """, (doc_id, filename, raw_text))
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"Error saving placeholder document: {e}")
        raise e
    finally:
        cursor.close()
        conn.close()

def set_document_error(doc_id: str, error_message: str) -> None:
    """Updates document status to 'error'."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE documents
            SET status = 'error', error_message = %s
            WHERE id = %s
        """, (error_message, doc_id))
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"Error setting document error: {e}")
    finally:
        cursor.close()
        conn.close()

def save_document_analysis(doc_id: str, result: DocumentAnalysisResult) -> None:
    """Saves full document and clause-level analysis into database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 1. Update documents table
        cursor.execute("""
            UPDATE documents
            SET status = 'done',
                health_score = %s,
                summary = %s,
                processing_time_seconds = %s,
                document_type = %s
            WHERE id = %s
        """, (
            result.health_score,
            result.summary,
            result.processing_time_seconds,
            result.document_type,
            doc_id
        ))
        
        # 2. Insert clauses and their risk_flags
        for idx, clause in enumerate(result.clauses):
            clause_db_id = clause.id
            
            # Insert into clauses table
            # Note: We omit embedding field here during saving to keep it lightweight,
            # or save if needed for future searches. Let's omit vector insert to keep it fast.
            cursor.execute("""
                INSERT INTO clauses (id, doc_id, text, section_path, order_index)
                VALUES (%s, %s, %s, %s, %s)
            """, (clause_db_id, doc_id, clause.original_text, clause.section_location, idx + 1))
            
            # Insert into risk_flags table
            cursor.execute("""
                INSERT INTO risk_flags (
                    clause_id, title, category, risk_level, confidence,
                    reasoning, plain_language, rag_comparison, rule_flags,
                    compared_reference_ids, section_location
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                clause_db_id,
                clause.title,
                clause.category.value,
                clause.risk_level.value,
                clause.confidence,
                clause.explanation,      # reasoning/explanation mapped to explanation field
                clause.simplified_text,
                clause.rag_comparison,
                clause.rule_flags,
                clause.compared_reference_ids,
                clause.section_location
            ))
            
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"Error saving document analysis: {e}")
        raise e
    finally:
        cursor.close()
        conn.close()

def get_document_analysis(doc_id: str) -> DocumentAnalysisResult | None:
    """Retrieves document analysis results from Postgres if completed, otherwise returns status."""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Fetch document meta
        cursor.execute("""
            SELECT id, filename, status, health_score, summary, error_message, created_at, processing_time_seconds, document_type
            FROM documents
            WHERE id = %s
        """, (doc_id,))
        doc_row = cursor.fetchone()
        
        if not doc_row:
            return None
            
        status = doc_row['status']
        created_at_str = doc_row['created_at'].strftime("%b %d, %Y")
        
        if status != 'done':
            return DocumentAnalysisResult(
                id=str(doc_row['id']),
                status=DocumentStatus(status),
                filename=doc_row['filename'],
                document_type=doc_row['document_type'] or "custom",
                upload_date=created_at_str,
                error_message=doc_row['error_message']
            )
            
        # Fetch clause details and risk flags
        cursor.execute("""
            SELECT c.id, c.text as original_text, c.section_path,
                   r.title, r.category, r.risk_level, r.confidence, r.reasoning,
                   r.plain_language, r.rag_comparison, r.compared_reference_ids, r.rule_flags
            FROM clauses c
            JOIN risk_flags r ON c.id = r.clause_id
            WHERE c.doc_id = %s
            ORDER BY c.order_index ASC
        """, (doc_id,))
        clause_rows = cursor.fetchall()
        
        clauses = []
        category_breakdown = {}
        
        for r in clause_rows:
            category_val = r['category']
            risk_level_val = r['risk_level']
            
            # Increment breakdown
            category_breakdown[category_val] = category_breakdown.get(category_val, 0) + 1
            
            ref_ids = [str(uid) for uid in r['compared_reference_ids']] if r['compared_reference_ids'] else []
            
            clauses.append(AnalyzedClause(
                id=str(r['id']),
                title=r['title'],
                category=ClauseCategory(category_val),
                risk_level=RiskLevel(risk_level_val),
                confidence=float(r['confidence']),
                original_text=r['original_text'],
                simplified_text=r['plain_language'],
                explanation=r['reasoning'],
                rag_comparison=r['rag_comparison'],
                compared_reference_ids=ref_ids,
                section_location=r['section_path'] or "",
                rule_flags=r['rule_flags'] or []
            ))
            
        # Top 5 risks (high or medium, sorted by confidence desc)
        top_risks = [c for c in clauses if c.risk_level in (RiskLevel.RISKY, RiskLevel.CAUTIONARY)]
        top_risks.sort(key=lambda x: (x.risk_level == RiskLevel.RISKY, x.confidence), reverse=True)
        top_risks = top_risks[:5]
        
        return DocumentAnalysisResult(
            id=str(doc_row['id']),
            status=DocumentStatus.DONE,
            filename=doc_row['filename'],
            document_type=doc_row['document_type'] or "custom",
            upload_date=created_at_str,
            health_score=doc_row['health_score'],
            summary=doc_row['summary'],
            clauses=clauses,
            top_risks=top_risks,
            category_breakdown=category_breakdown,
            processing_time_seconds=doc_row['processing_time_seconds']
        )
        
    except Exception as e:
        print(f"Error fetching document analysis: {e}")
        return None
    finally:
        cursor.close()
        conn.close()
