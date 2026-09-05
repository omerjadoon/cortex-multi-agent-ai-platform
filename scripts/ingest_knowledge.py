import asyncio
import os
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ingest_knowledge")

from backend.ingestion.ingest import ingest_document

KNOWLEDGE_DIR = Path("/Users/omerkhanjadoon/Desktop/openmind/backend/knowledge/en")
COLLECTION = "cortex"


async def main():
    if not KNOWLEDGE_DIR.exists():
        logger.error(f"Directory {KNOWLEDGE_DIR} does not exist.")
        return

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
            if idx % 10 == 0 or idx == len(md_files):
                logger.info(f"[{idx}/{len(md_files)}] Ingested {rel_path} ({chunks} chunks)")
        except Exception as exc:
            logger.error(f"Failed to ingest {filepath}: {exc}")

    logger.info(f"Ingestion complete! Successfully ingested {ingested_files} files into '{COLLECTION}' with {total_chunks} total chunks.")


if __name__ == "__main__":
    asyncio.run(main())
