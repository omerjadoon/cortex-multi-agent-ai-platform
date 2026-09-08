import asyncio
import os
from pathlib import Path
import logging
from sqlalchemy import delete as sql_delete

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ingest_knowledge")

from backend.ingestion.ingest import ingest_document
from backend.auth.models import Document
from backend.db.session import AsyncSessionLocal
from backend.search.semantic import semantic_search
from backend.search.bm25 import bm25_index

BASE_DIR = Path(__file__).resolve().parent.parent
KNOWLEDGE_DIR = BASE_DIR / "backend/knowledge/en"
COLLECTION = "cortex"


async def purge_existing_data():
    """Purge old document records from Postgres and Qdrant collection to ensure a clean repopulation."""
    logger.info(f"Purging existing data for collection '{COLLECTION}'...")
    
    # 1. Clear Postgres documents
    async with AsyncSessionLocal() as session:
        await session.execute(sql_delete(Document).where(Document.collection_name == COLLECTION))
        await session.commit()
    logger.info("Cleared Postgres documents table.")

    # 2. Re-create Qdrant collection
    try:
        await semantic_search.client.delete_collection(COLLECTION)
        logger.info(f"Deleted Qdrant collection '{COLLECTION}'.")
    except Exception as exc:
        logger.warning(f"Qdrant collection deletion notice: {exc}")

    await semantic_search.ensure_collection(COLLECTION)
    logger.info(f"Initialized fresh Qdrant collection '{COLLECTION}'.")


async def main():
    if not KNOWLEDGE_DIR.exists():
        logger.error(f"Directory {KNOWLEDGE_DIR} does not exist.")
        return

    await purge_existing_data()

    md_files = list(KNOWLEDGE_DIR.glob("**/*.md"))
    logger.info(f"Found {len(md_files)} markdown files in {KNOWLEDGE_DIR}")

    total_chunks = 0
    ingested_files = 0

    for idx, filepath in enumerate(md_files, 1):
        try:
            rel_path = str(filepath.relative_to(KNOWLEDGE_DIR))
            content = filepath.read_text(encoding="utf-8").strip()
            if not content:
                continue

            chunks = await ingest_document(COLLECTION, rel_path, content)
            total_chunks += chunks
            ingested_files += 1
            if idx % 25 == 0 or idx == len(md_files):
                logger.info(f"[{idx}/{len(md_files)}] Ingested {rel_path} ({chunks} chunks)")
        except Exception as exc:
            logger.error(f"Failed to ingest {filepath}: {exc}")

    logger.info(f"Ingestion complete! Successfully ingested {ingested_files} files into '{COLLECTION}' with {total_chunks} total chunks.")


if __name__ == "__main__":
    asyncio.run(main())
