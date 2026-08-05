import re
import os
import uuid
from pydantic import BaseModel
from .parser import ParsedDocument
from ..models.clause import ExtractedClause
from ..services.gemini import generate_content_with_retry

class LLMClauseSegment(BaseModel):
    title: str
    text: str

class LLMClauseSegmentList(BaseModel):
    clauses: list[LLMClauseSegment]

def split_by_regex(text: str) -> list[tuple[str, str]]:
    """Attempts to split text into clauses using standard legal numbering markers."""
    # Pattern matches things like: 5.2 Clause Title, Section 3. Payment, ARTICLE IV, § 4
    pattern = r'(?:\n|^)(?:(?:Section|SECTION|Article|ARTICLE|§)\s+\d+[\w\.\-]*|(?:\d+\.\d+)+)\s*(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)?'
    
    matches = list(re.finditer(pattern, text))
    if len(matches) < 2:
        return []
        
    clauses = []
    for idx, match in enumerate(matches):
        start = match.start()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        
        clause_header = match.group().strip()
        clause_text = text[start:end].strip()
        
        if len(clause_text) > 20:  # Skip empty or tiny matched fragments
            clauses.append((clause_header, clause_text))
            
    return clauses

def get_segmentation_prompt_template() -> str:
    path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prompts", "segmentation_v1.txt")
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def split_by_llm(text: str) -> list[tuple[str, str]]:
    """Segments unstructured text into clauses using Gemini Flash."""
    try:
        template = get_segmentation_prompt_template()
        prompt = template.replace("{text}", text)
        
        # Request structured output matching the LLMClauseSegmentList schema
        json_output = generate_content_with_retry(
            prompt, 
            response_schema=LLMClauseSegmentList,
            temperature=0.1
        )
        
        # Parse output
        import json
        data = json.loads(json_output)
        
        clauses = []
        for c in data.get("clauses", []):
            if c.get("text") and len(c["text"].strip()) > 10:
                clauses.append((c.get("title", "Clause"), c["text"].strip()))
        return clauses
    except Exception as e:
        print(f"LLM segmentation failed, falling back to paragraph split: {e}")
        return []

def split_by_paragraphs(text: str) -> list[tuple[str, str]]:
    """Splits text by double newlines as a final fallback."""
    paragraphs = text.split("\n\n")
    clauses = []
    for idx, p in enumerate(paragraphs):
        stripped = p.strip()
        if len(stripped) > 20:
            clauses.append((f"Provision {idx + 1}", stripped))
    return clauses

def segment_document(parsed_doc: ParsedDocument) -> list[ExtractedClause]:
    """Orchestrates the 3-tier clause segmentation process."""
    extracted = []
    
    # Try regex first across full text
    regex_clauses = split_by_regex(parsed_doc.raw_text)
    
    if len(regex_clauses) >= 3:
        print(f"Segmented {len(regex_clauses)} clauses using regex-based splitting.")
        for idx, (title, text) in enumerate(regex_clauses):
            # Calculate rough char offsets
            char_offset = parsed_doc.raw_text.find(text)
            extracted.append(ExtractedClause(
                clause_id=str(uuid.uuid4()),
                text=text,
                section_path=title,
                order_index=idx + 1,
                char_offset_start=char_offset if char_offset != -1 else None,
                char_offset_end=char_offset + len(text) if char_offset != -1 else None
            ))
        return extracted
        
    # Fallback to LLM segmentation (process in slices if document is long)
    print("Document is unstructured or numbering-free. Running Gemini segmentation...")
    words = parsed_doc.raw_text.split()
    chunk_size = 800  # roughly 1000 tokens
    chunks = [" ".join(words[i:i + chunk_size]) for i in range(0, len(words), chunk_size)]
    
    clause_index = 1
    for chunk_idx, chunk in enumerate(chunks):
        chunk_clauses = split_by_llm(chunk)
        
        # If LLM failed, fall back to paragraph split for this chunk
        if not chunk_clauses:
            chunk_clauses = split_by_paragraphs(chunk)
            
        for title, text in chunk_clauses:
            char_offset = parsed_doc.raw_text.find(text)
            extracted.append(ExtractedClause(
                clause_id=str(uuid.uuid4()),
                text=text,
                section_path=f"Section {chunk_idx + 1} > {title}",
                order_index=clause_index,
                char_offset_start=char_offset if char_offset != -1 else None,
                char_offset_end=char_offset + len(text) if char_offset != -1 else None
            ))
            clause_index += 1
            
    return extracted
