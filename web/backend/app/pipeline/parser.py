import io
import pdfplumber
import docx
from ..models.base import CamelModel

class PageContent(CamelModel):
    page_number: int
    text: str

class SectionNode(CamelModel):
    title: str
    content: str
    level: int

class ParsedDocument(CamelModel):
    raw_text: str
    pages: list[PageContent]
    sections: list[SectionNode]

def parse_pdf(file_bytes: bytes) -> ParsedDocument:
    raw_text = ""
    pages = []
    sections = []
    
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for idx, page in enumerate(pdf.pages):
            page_text = page.extract_text() or ""
            pages.append(PageContent(page_number=idx + 1, text=page_text))
            raw_text += page_text + "\n"
            
    # Simple rule-based headers extraction for sections
    lines = raw_text.split("\n")
    current_section_title = "Introduction"
    current_section_content = ""
    
    for line in lines:
        stripped = line.strip()
        # If the line is short, in all caps or starts with Section/Article, treat as a potential header
        if len(stripped) < 100 and (stripped.isupper() or stripped.startswith(("SECTION", "Section", "ARTICLE", "Article", "§"))):
            if current_section_content.strip():
                sections.append(SectionNode(
                    title=current_section_title,
                    content=current_section_content.strip(),
                    level=1
                ))
            current_section_title = stripped
            current_section_content = ""
        else:
            current_section_content += line + "\n"
            
    if current_section_content.strip():
        sections.append(SectionNode(
            title=current_section_title,
            content=current_section_content.strip(),
            level=1
        ))
        
    return ParsedDocument(raw_text=raw_text, pages=pages, sections=sections)

def parse_docx(file_bytes: bytes) -> ParsedDocument:
    doc = docx.Document(io.BytesIO(file_bytes))
    raw_text = ""
    pages = []
    sections = []
    
    current_section_title = "Introduction"
    current_section_content = ""
    
    for p in doc.paragraphs:
        text = p.text
        raw_text += text + "\n"
        
        # docx has style information to detect headings easily
        if p.style.name.startswith("Heading"):
            if current_section_content.strip():
                sections.append(SectionNode(
                    title=current_section_title,
                    content=current_section_content.strip(),
                    level=int(p.style.name.replace("Heading", "") or 1)
                ))
            current_section_title = text
            current_section_content = ""
        else:
            current_section_content += text + "\n"
            
    if current_section_content.strip():
        sections.append(SectionNode(
            title=current_section_title,
            content=current_section_content.strip(),
            level=1
        ))
        
    # python-docx doesn't store native page numbers easily without rendering, so we put full text as Page 1
    pages.append(PageContent(page_number=1, text=raw_text))
    
    return ParsedDocument(raw_text=raw_text, pages=pages, sections=sections)

def parse_txt(file_text: str) -> ParsedDocument:
    sections = []
    lines = file_text.split("\n")
    current_section_title = "Document"
    current_section_content = ""
    
    for line in lines:
        stripped = line.strip()
        if len(stripped) < 80 and (stripped.isupper() or stripped.startswith(("SECTION", "Section", "ARTICLE", "Article"))):
            if current_section_content.strip():
                sections.append(SectionNode(
                    title=current_section_title,
                    content=current_section_content.strip(),
                    level=1
                ))
            current_section_title = stripped
            current_section_content = ""
        else:
            current_section_content += line + "\n"
            
    if current_section_content.strip():
        sections.append(SectionNode(
            title=current_section_title,
            content=current_section_content.strip(),
            level=1
        ))
        
    return ParsedDocument(
        raw_text=file_text,
        pages=[PageContent(page_number=1, text=file_text)],
        sections=sections
    )

def parse_document(file_bytes: bytes | None, filename: str | None, raw_text: str | None = None) -> ParsedDocument:
    if raw_text is not None:
        return parse_txt(raw_text)
    
    if not file_bytes or not filename:
        raise ValueError("Either raw_text or file_bytes and filename must be provided.")
        
    ext = filename.split(".")[-1].lower()
    if ext == "pdf":
        return parse_pdf(file_bytes)
    elif ext in ("docx", "doc"):
        return parse_docx(file_bytes)
    else:
        # Default to raw text decode
        try:
            text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text = file_bytes.decode("latin-1")
        return parse_txt(text)
