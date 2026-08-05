from ..models.clause import ExtractedClause
from ..models.reference import ReferenceClause
from ..services.gemini import get_gemini_client
from ..services.db import retrieve_similar_reference_clauses

def batch_retrieve_references(clauses: list[ExtractedClause], limit: int = 5, threshold: float = 0.45) -> dict[str, list[ReferenceClause]]:
    """Generates embeddings for all clauses in one batch, then retrieves similar reference clauses from DB."""
    if not clauses:
        return {}
        
    try:
        print(f"Generating batch embeddings for {len(clauses)} clauses...")
        client = get_gemini_client()
        texts = [c.text for c in clauses]
        
        # Batch call to Gemini embedding service
        response = client.models.embed_content(
            model="gemini-embedding-001",
            contents=texts
        )
        embeddings = [item.values for item in response.embeddings]
        
        print("Embeddings generated. Querying pgvector for each clause...")
        results = {}
        for clause, embedding in zip(clauses, embeddings):
            references = retrieve_similar_reference_clauses(embedding, limit=limit, threshold=threshold)
            results[clause.clause_id] = references
        return results
        
    except Exception as e:
        print(f"Batch embedding/retrieval failed: {e}")
        # Fallback to empty results to prevent pipeline failure
        return {c.clause_id: [] for c in clauses}
