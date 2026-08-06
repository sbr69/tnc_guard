import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .routers import documents, health, extension

app = FastAPI(
    title="ClarifyLaw API",
    description="RAG-powered legal agreement clause simplifier and risk flagger",
    version="1.0.0",
)

# Parse CORS whitelist
origins = [org.strip() for org in settings.cors_origins.split(",") if org.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(documents.router)
app.include_router(health.router)
app.include_router(extension.router)

@app.get("/")
async def root():
    return {
        "message": "Welcome to the ClarifyLaw API. Visit /docs or /redoc for API reference documentation.",
        "version": "1.0.0"
    }
