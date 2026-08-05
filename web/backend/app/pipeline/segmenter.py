import re
import uuid

from ..models.clause import ExtractedClause


def split_by_regex(text: str) -> list[tuple[str, str]]:
    """Splits structured legal documents using section titles, numbers, or headers."""
    pattern = r"(?:\n|^)(?:(?:Section|SECTION|Article|ARTICLE|§)\s+\d+[\w\.\-]*|(?:\d+\.\d+)+|[A-Z][A-Z\s]{3,30}|[A-Z]\.\s+[A-Z][a-z]+)\s*(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)?"

    matches = list(re.finditer(pattern, text))
    if len(matches) < 2:
        return []

    clauses: list[tuple[str, str]] = []
    for idx, match in enumerate(matches):
        start = match.start()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)

        clause_header = match.group().strip()
        clause_text = text[start:end].strip()

        if len(clause_text) > 30:
            clauses.append((clause_header, clause_text))

    return clauses


def split_by_paragraphs_and_sentences(text: str) -> list[tuple[str, str]]:
    """Deterministic fallback: splits unstructured documents cleanly on double newlines and logical paragraph boundaries."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    clauses: list[tuple[str, str]] = []
    
    current_title_idx = 1
    for p in paragraphs:
        if len(p) < 25:  # Likely a standalone title/header line
            continue
        
        # If a single paragraph is enormous (> 1500 chars), split on sentence boundaries
        if len(p) > 1500:
            sentences = re.split(r"(?<=[.!?])\s+", p)
            buffer = ""
            sub_idx = 1
            for s in sentences:
                buffer += s + " "
                if len(buffer) >= 600:
                    clauses.append((f"Provision {current_title_idx}.{sub_idx}", buffer.strip()))
                    buffer = ""
                    sub_idx += 1
            if buffer.strip():
                clauses.append((f"Provision {current_title_idx}.{sub_idx}", buffer.strip()))
            current_title_idx += 1
        else:
            first_words = " ".join(p.split()[:4])
            title = f"Section {current_title_idx}: {first_words}..."
            clauses.append((title, p))
            current_title_idx += 1

    return clauses


def segment_document(parsed_doc) -> list[ExtractedClause]:
    """Segment document using zero-latency, 100% deterministic rules."""
    extracted: list[ExtractedClause] = []
    raw_text = parsed_doc.raw_text

    regex_clauses = split_by_regex(raw_text)
    if len(regex_clauses) >= 3:
        print(f"Segmented {len(regex_clauses)} clauses using regex-based splitting.")
        for idx, (title, clause_text) in enumerate(regex_clauses):
            char_offset = raw_text.find(clause_text)
            extracted.append(
                ExtractedClause(
                    clause_id=str(uuid.uuid4()),
                    text=clause_text,
                    section_path=title,
                    order_index=idx + 1,
                    char_offset_start=char_offset if char_offset != -1 else None,
                    char_offset_end=char_offset + len(clause_text) if char_offset != -1 else None,
                )
            )
        return extracted

    print("Running deterministic paragraph & sentence segmentation...")
    fallback_clauses = split_by_paragraphs_and_sentences(raw_text)
    for idx, (title, clause_text) in enumerate(fallback_clauses):
        char_offset = raw_text.find(clause_text)
        extracted.append(
            ExtractedClause(
                clause_id=str(uuid.uuid4()),
                text=clause_text,
                section_path=title,
                order_index=idx + 1,
                char_offset_start=char_offset if char_offset != -1 else None,
                char_offset_end=char_offset + len(clause_text) if char_offset != -1 else None,
            )
        )

    print(f"Successfully segmented document into {len(extracted)} clauses deterministically.")
    return extracted

