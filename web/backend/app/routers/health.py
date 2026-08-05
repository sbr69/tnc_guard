import time
from fastapi import APIRouter

router = APIRouter(tags=["Health"])

@router.get("/health")
async def health_check():
    """Simple keep-alive health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": time.time()
    }
