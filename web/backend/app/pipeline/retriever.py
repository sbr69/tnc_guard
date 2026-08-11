from concurrent.futures import ThreadPoolExecutor, as_completed

from ..models.clause import ExtractedClause
from ..models.reference import ReferenceClause
from ..services.gemini import get_gemini_client, _gemini_limiter
from ..services.db import retrieve_similar_reference_clauses

# Per-text embedding cache. Gemini embeddings are deterministic for identical
# input, so reusing them is accuracy-safe and cuts embedding API calls when
# boilerplate clauses repeat across the policies of a site (or across re-runs).
_embedding_cache: dict[str, list[float]] = {}
_EMBEDDING_CACHE_MAX = 4096


def _generate_embeddings(texts: list[str]) -> list[list[float]]:
    client = get_gemini_client()

    results: list[list[float] | None] = [None] * len(texts)
    uncached_indices: list[int] = []
    uncached_texts: list[str] = []

    for i, text in enumerate(texts):
        cached = _embedding_cache.get(text)
        if cached is not None:
            results[i] = cached
        else:
            uncached_indices.append(i)
            uncached_texts.append(text)

    if uncached_texts:
        print(f"Generating batch embeddings for {len(uncached_texts)} uncached clauses ({len(texts) - len(uncached_texts)} cached)...")
        chunk_size = 50
        for i in range(0, len(uncached_texts), chunk_size):
            chunk = uncached_texts[i:i + chunk_size]
            # Pace Gemini calls to stay under the free-tier RPM cap.
            _gemini_limiter().acquire()
            response = client.models.embed_content(
                model="gemini-embedding-001",
                contents=chunk
            )
            values = [item.values for item in response.embeddings]
            for j, text in enumerate(chunk):
                if len(_embedding_cache) >= _EMBEDDING_CACHE_MAX:
                    _embedding_cache.pop(next(iter(_embedding_cache)), None)
                _embedding_cache[text] = values[j]
                results[uncached_indices[i + j]] = values[j]

    return [r for r in results]  # type: ignore[list-item]


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
