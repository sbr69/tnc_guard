from concurrent.futures import ThreadPoolExecutor, as_completed

from ..models.clause import ExtractedClause
from ..models.reference import ReferenceClause
from ..services.gemini import get_gemini_client
from ..services.db import retrieve_similar_reference_clauses


def _generate_embeddings(texts: list[str]) -> list[list[float]]:
    client = get_gemini_client()
    embeddings = []
    chunk_size = 50
    for i in range(0, len(texts), chunk_size):
        chunk = texts[i:i + chunk_size]
        response = client.models.embed_content(
            model="gemini-embedding-001",
            contents=chunk
        )
        embeddings.extend([item.values for item in response.embeddings])
    return embeddings


def batch_retrieve_references(clauses: list[ExtractedClause], limit: int = 5, threshold: float = 0.45) -> dict[str, list[ReferenceClause]]:
    if not clauses:
        return {}

    try:
        print(f"Generating batch embeddings for {len(clauses)} clauses...")
        texts = [c.text for c in clauses]
        embeddings = _generate_embeddings(texts)

        print("Embeddings generated. Querying pgvector in parallel...")
        results = {}
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = {
                executor.submit(
                    retrieve_similar_reference_clauses, embedding, limit, threshold
                ): clause.clause_id
                for clause, embedding in zip(clauses, embeddings)
            }
            for future in as_completed(futures):
                clause_id = futures[future]
                results[clause_id] = future.result()
        return results

    except Exception as e:
        print(f"Batch embedding/retrieval failed: {e}")
        return {c.clause_id: [] for c in clauses}
