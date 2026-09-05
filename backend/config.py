from pydantic_settings import BaseSettings
from functools import lru_cache
import os

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/cortex"
    qdrant_url: str = "http://localhost:6333"
    jwt_secret: str = "changeme"
    jwt_expire_minutes: int = 1440
    langfuse_secret_key: str = ""
    langfuse_public_key: str = ""
    langfuse_host: str = "http://localhost:3030"
    embedding_model: str = "all-MiniLM-L6-v2"
    groq_api_key: str = ""
    chunk_size: int = 512
    chunk_overlap: int = 64

    class Config:
        env_file = ".env"
        extra = "ignore"

    def __getattr__(self, name: str):
        lowered = name.lower()
        if lowered in self.__dict__ or lowered in self.model_fields:
            return getattr(self, lowered)
        raise AttributeError(f"'{type(self).__name__}' object has no attribute '{name}'")

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
