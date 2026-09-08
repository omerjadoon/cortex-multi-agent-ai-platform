from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from backend.db.session import engine, Base
from backend.auth.routes import router as auth_router
from backend.api.chat import router as chat_router
from backend.api.collections import router as collections_router
from backend.api.feedback import router as feedback_router
from backend.api.security import router as security_router


import logging
from backend.config import settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.jwt_secret == "changeme":
        logger.warning("SECURITY WARNING: JWT_SECRET is set to default 'changeme'. Change this in production!")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title="Cortex AI", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(chat_router, prefix="/chat")
app.include_router(collections_router, prefix="/collections")
app.include_router(feedback_router, prefix="/feedback")
app.include_router(security_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
