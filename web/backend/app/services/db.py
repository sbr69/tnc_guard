import os
import json
import psycopg2
from psycopg2.pool import ThreadedConnectionPool
from psycopg2.extras import RealDictCursor, execute_values
from contextlib import contextmanager
from ..config import settings
from ..models.reference import ReferenceClause
from ..models.clause import AnalyzedClause, RiskLevel, ClauseCategory
from ..models.document import DocumentAnalysisResult, DocumentStatus

_pool: ThreadedConnectionPool | None = None

def _init_pool():
    global _pool
    if _pool is not None:
        return
    database_url = settings.database_url or os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL is not configured. Please set it in your .env file.")
    _pool = ThreadedConnectionPool(
        minconn=2,
        maxconn=20,
        dsn=database_url
    )
    _ensure_migrations()


def _ensure_migrations():
    """Idempotent schema migrations for content-hash dedup.

    Adds ``content_hash`` and ``source_doc_id`` to ``documents`` so identical
    policy text can be reused (zero Gemini) across users/re-runs. Safe on
    existing databases: columns are nullable, existing rows get NULL.
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_hash TEXT;")
                cursor.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_doc_id UUID;")
                cursor.execute(
                    "CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash);"
                )
                conn.commit()
            except Exception as e:
                conn.rollback()
                print(f"[migrations] content_hash migration skipped: {e}")
            finally:
                cursor.close()
    except Exception as e:
        print(f"[migrations] could not run: {e}")

@contextmanager
def get_db_connection():
    _init_pool()
    conn = _pool.getconn()
    try:
        yield conn
    finally:
        _pool.putconn(conn)

def retrieve_similar_reference_clauses(embedding: list[float], limit: int = 5, threshold: float = 0.45) -> list[ReferenceClause]:
    """Queries Supabase Postgres using pgvector to return top-k matches above similarity threshold."""
    with get_db_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
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

def save_placeholder_document(doc_id: str, filename: str, raw_text: str, content_hash: str | None = None) -> None:
    """Inserts a document record with status = 'processing'."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO documents (id, filename, raw_text, status, content_hash)
                VALUES (%s, %s, %s, 'processing', %s)
                ON CONFLICT (id) DO NOTHING
            """, (doc_id, filename, raw_text, content_hash))
            conn.commit()
        except Exception as e:
            conn.rollback()
            print(f"Error saving placeholder document: {e}")
            raise e
        finally:
            cursor.close()

def get_done_doc_id_by_hash(content_hash: str, exclude_id: str | None = None) -> str | None:
    """Return the id of a completed document with the same content hash, if any.

    Used for content-hash dedup: identical policy text reuses a prior analysis
    instead of re-running the RAG pipeline (zero Gemini cost).
    """
    if not content_hash:
        return None
    with get_db_connection() as conn:
        cursor = conn.cursor()
        try:
            if exclude_id:
                cursor.execute(
                    "SELECT id FROM documents WHERE content_hash = %s AND status = 'done' AND id != %s LIMIT 1;",
                    (content_hash, exclude_id),
                )
            else:
                cursor.execute(
                    "SELECT id FROM documents WHERE content_hash = %s AND status = 'done' LIMIT 1;",
                    (content_hash,),
                )
            row = cursor.fetchone()
            return str(row[0]) if row else None
        except Exception as e:
            print(f"Error looking up document by content hash: {e}")
            return None
        finally:
            cursor.close()

def mark_document_reuse(doc_id: str, source_doc_id: str, health_score: int | None, summary: str | None, processing_time: float | None, doc_type: str) -> None:
    """Mark ``doc_id`` as done, pointing at ``source_doc_id`` for its clauses.

    No clauses are copied — ``get_document_analysis`` resolves ``source_doc_id``
    and serves the source's clauses under this id.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("""
                UPDATE documents
                SET status = 'done',
                    health_score = %s,
                    summary = %s,
                    processing_time_seconds = %s,
                    document_type = %s,
                    source_doc_id = %s
                WHERE id = %s
            """, (health_score, summary, processing_time, doc_type, source_doc_id, doc_id))
            conn.commit()
        except Exception as e:
            conn.rollback()
            print(f"Error marking document reuse: {e}")
            raise e
        finally:
            cursor.close()

def set_document_error(doc_id: str, error_message: str) -> None:
    """Updates document status to 'error'."""
    with get_db_connection() as conn:
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

def save_document_analysis(doc_id: str, result: DocumentAnalysisResult) -> None:
    """Saves full document and clause-level analysis into database."""
    with get_db_connection() as conn:
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

            # 2. Batch-insert clauses (single round-trip instead of one per clause)
            clause_rows = [
                (clause.id, doc_id, clause.original_text, clause.section_location, idx + 1)
                for idx, clause in enumerate(result.clauses)
            ]
            if clause_rows:
                execute_values(
                    cursor,
                    """
                    INSERT INTO clauses (id, doc_id, text, section_path, order_index)
                    VALUES %s
                    """,
                    clause_rows,
                    page_size=100,
                )

            # 3. Batch-insert risk_flags (one round-trip). compared_reference_ids
            #    is a uuid[] column, hence the explicit cast in the template.
            risk_rows = [
                (
                    clause.id,
                    clause.title,
                    clause.category.value,
                    clause.risk_level.value,
                    clause.confidence,
                    clause.explanation,
                    clause.simplified_text,
                    clause.rag_comparison,
                    clause.rule_flags,
                    clause.compared_reference_ids,
                    clause.section_location,
                )
                for clause in result.clauses
            ]
            if risk_rows:
                execute_values(
                    cursor,
                    """
                    INSERT INTO risk_flags (
                        clause_id, title, category, risk_level, confidence,
                        reasoning, plain_language, rag_comparison, rule_flags,
                        compared_reference_ids, section_location
                    ) VALUES %s
                    """,
                    risk_rows,
                    template="(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::uuid[], %s)",
                    page_size=100,
                )

            conn.commit()
        except Exception as e:
            conn.rollback()
            print(f"Error saving document analysis: {e}")
            raise e
        finally:
            cursor.close()

def get_document_analysis(doc_id: str) -> DocumentAnalysisResult | None:
    """Retrieves document analysis results from Postgres if completed, otherwise returns status."""
    with get_db_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # Fetch document meta
            cursor.execute("""
                SELECT id, filename, status, health_score, summary, error_message, created_at,
                       processing_time_seconds, document_type, source_doc_id
                FROM documents
                WHERE id = %s
            """, (doc_id,))
            doc_row = cursor.fetchone()
            
            if not doc_row:
                return None
                
            status = doc_row['status']
            created_at_str = doc_row['created_at'].strftime("%b %d, %Y")
            source_doc_id = doc_row.get('source_doc_id')

            if status != 'done':
                return DocumentAnalysisResult(
                    id=str(doc_row['id']),
                    status=DocumentStatus(status),
                    filename=doc_row['filename'],
                    document_type=doc_row['document_type'] or "custom",
                    upload_date=created_at_str,
                    error_message=doc_row['error_message']
                )

            # Content-hash dedup: if this document points at a source, serve the
            # source's clauses under this id (no rows are copied).
            clause_doc_id = str(source_doc_id) if source_doc_id else doc_id

            # Fetch clause details and risk flags (from the source if reused)
            cursor.execute("""
                SELECT c.id, c.text as original_text, c.section_path,
                       r.title, r.category, r.risk_level, r.confidence, r.reasoning,
                       r.plain_language, r.rag_comparison, r.compared_reference_ids, r.rule_flags
                FROM clauses c
                JOIN risk_flags r ON c.id = r.clause_id
                WHERE c.doc_id = %s
                ORDER BY c.order_index ASC
            """, (clause_doc_id,))
            clause_rows = cursor.fetchall()
            
            clauses = []
            category_breakdown = {}
            
            for r in clause_rows:
                category_val = r['category']
                risk_level_val = r['risk_level']
                
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
