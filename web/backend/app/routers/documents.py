import uuid
from cachetools import TTLCache
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from ..models.document import DocumentAnalysisResult, DocumentStatus
from ..pipeline import run_analysis_pipeline
from ..services.db import save_placeholder_document, get_document_analysis

router = APIRouter(prefix="/api/documents", tags=["Documents"])

_result_cache = TTLCache(maxsize=100, ttl=300)

@router.post("", status_code=202)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile | None = File(None),
    raw_text: str | None = Form(None),
    url: str | None = Form(None),
    document_type: str = Form("custom")
):
    """
    Accepts file upload (PDF/Word/Text) or raw text input.
    Kicks off RAG pipeline in background.
    """
    if file is None and raw_text is None and url is None:
        raise HTTPException(status_code=400, detail="Must provide either a file upload, raw_text input, or a url.")

    if url is not None and not url.strip().startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid URL. Must start with http:// or https://")
        
    doc_id = str(uuid.uuid4())
    
    if file:
        filename = file.filename or "uploaded_file.txt"
        file_bytes = await file.read()
        raw_input_text = None
    elif url:
        filename = "url_import.txt"
        file_bytes = None
        raw_input_text = f"URL Content: {url}"
    else:
        filename = "pasted_text.txt"
        file_bytes = None
        raw_input_text = raw_text
        
    # Save placeholder in DB
    try:
        save_placeholder_document(doc_id, filename, raw_input_text or "PDF/Word content")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database initialization failed: {e}")
        
    # Run pipeline in background task
    background_tasks.add_task(
        run_analysis_pipeline,
        doc_id=doc_id,
        filename=filename,
        file_bytes=file_bytes,
        raw_text=raw_input_text if not url else None,
        url=url,
        doc_type=document_type
    )
    
    return {
        "id": doc_id,
        "status": "processing",
        "filename": filename,
        "message": "Analysis started. Please poll /api/documents/{id} for results."
    }

@router.get("/{document_id}", response_model=DocumentAnalysisResult)
async def get_document(document_id: str):
    """Retrieves document processing status and full analysis once completed."""
    if document_id in _result_cache:
        return _result_cache[document_id]

    result = get_document_analysis(document_id)
    if not result:
        raise HTTPException(status_code=404, detail="Document analysis not found.")

    if result.status == DocumentStatus.DONE:
        _result_cache[document_id] = result
    return result

@router.get("/demo/all", tags=["Demo"])
async def get_demo_documents():
    """Returns static pre-analyzed documents for instant homepage CTA demonstration."""
    # We load standard mock reports to ensure immediate dashboard demonstration
    from .demo_data import MOCK_DEMOS
    return MOCK_DEMOS
