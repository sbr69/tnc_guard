import re
import uuid

from ..models.clause import ExtractedClause


def split_by_regex(text: str) -> list[tuple[str, str]]:
    """Splits structured legal documents using section titles, numbers, or headers."""
    pattern = r"(?:\n|^)(?:(?:Section|SECTION|Article|ARTICLE|§)[ \t]+\d+[\w\.\-]*|(?:\d+\.\d+)+|(?:\d+\.)|[A-Z][A-Z \t]{3,30}|[A-Z]\.)[ \t]*(?:[A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+)*)?"

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


_HEADER_LINE_RE = re.compile(
    r"^(?:"
    r"(?:\d+[\.\)]\s*)"               # "1." "1)"
    r"|(?:\d+\.\d+(?:\.\d+)*\s*)"     # "1.1" "1.1.1"
    r"|(?:Section|Article|§)\s+\d+"   # "Section 1"
    r"|[A-Z][A-Z \t&]{3,40}"          # ALL-CAPS header
    r"|[IVXLCDM]+\."                  # roman numeral
    r")"
, re.I)


def _reconstruct_paragraphs(text: str) -> list[str]:
    """Merge line-wrapped text into real paragraphs.

    HTML/PDF extraction often yields one visual line per ``\\n``. Treating each
    line as its own clause produces hundreds of fragments. A new paragraph
    starts at a header-like line or a blank line; other lines are continuations
    of the current paragraph. A hard size cap prevents unbounded merging on
    dense, header-less text.
    """
    paragraphs: list[str] = []
    current: list[str] = []
    for raw in text.split("\n"):
        line = raw.strip()
        if not line:
            if current:
                paragraphs.append(" ".join(current))
                current = []
            continue
        is_header = bool(_HEADER_LINE_RE.match(line)) and len(line) < 80
        joined = " ".join(current) if current else ""
        if current and (is_header or len(joined) >= 800):
            paragraphs.append(joined)
            current = [line]
        else:
            current.append(line)
    if current:
        paragraphs.append(" ".join(current))
    return [p for p in paragraphs if p]


def split_by_paragraphs_and_sentences(text: str) -> list[tuple[str, str]]:
    """Deterministic fallback: splits unstructured documents cleanly on double newlines and logical paragraph boundaries."""
    # PDF parsing often gives single \n instead of \n\n. If there are almost no \n\n, try to split by \n.
    if text.count("\n\n") < 2 and text.count("\n") > 5:
        # replace single newlines that don't look like paragraph ends with spaces
        text = re.sub(r'(?<![.!?])\n(?=[a-z])', ' ', text)
        # Reconstruct real paragraphs so each clause is a paragraph, not a
        # single line fragment (cuts clause count sharply on line-wrapped text).
        paragraphs = _reconstruct_paragraphs(text)
    else:
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    clauses: list[tuple[str, str]] = []
    
    current_title_idx = 1
    buffer = ""
    for p in paragraphs:
        if len(p) < 25:
            # It's a short line, might be a header. Append to buffer so we don't lose text.
            buffer += p + "\n"
            continue
            
        full_p = (buffer + p).strip()
        buffer = ""
        
        # If a single paragraph is enormous (> 1500 chars), split on sentence boundaries
        if len(full_p) > 1500:
            sentences = re.split(r"(?<=[.!?])\s+", full_p)
            sentence_buffer = ""
            sub_idx = 1
            for s in sentences:
                sentence_buffer += s + " "
                if len(sentence_buffer) >= 600:
                    clauses.append((f"Provision {current_title_idx}.{sub_idx}", sentence_buffer.strip()))
                    sentence_buffer = ""
                    sub_idx += 1
            if sentence_buffer.strip():
                clauses.append((f"Provision {current_title_idx}.{sub_idx}", sentence_buffer.strip()))
            current_title_idx += 1
        else:
            first_words = " ".join(full_p.split()[:4])
            title = f"Section {current_title_idx}: {first_words}..."
            clauses.append((title, full_p))
            current_title_idx += 1

    if buffer.strip():
        clauses.append((f"Section {current_title_idx}", buffer.strip()))

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

