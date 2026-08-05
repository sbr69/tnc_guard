import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Load env variables from .env if present
for path in [".env", "backend/.env", "../.env", "../../.env"]:
    if os.path.exists(path):
        load_dotenv(path)
        break

class Settings(BaseSettings):
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    database_url: str = os.getenv("DATABASE_URL", "")
    cors_origins: str = os.getenv("CORS_ORIGINS", "*")

    class Config:
        extra = "ignore"

settings = Settings()
