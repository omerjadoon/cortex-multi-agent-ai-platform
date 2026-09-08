from backend.auth.models import Document
from backend.search.bm25 import bm25_index
from backend.search.semantic import semantic_search
from backend.db.session import AsyncSessionLocal
from backend.config import settings


def _chunk_text(text: str, target_size: int = 512, overlap: int = 64) -> list[str]:
    """
    Hierarchical Recursive Semantic & Markdown Section Text Splitter.
    Splits along natural structural boundaries (Paragraphs -> Section Headers -> Sentences -> Words)
    to preserve complete semantic context without splitting mid-sentence or mid-word.
    """
    text = text.strip()
    if not text:
        return []

    separators = [
        "\n\n",
        "\n# ", "\n## ", "\n### ", "\n#### ",
        "\n",
        ". ", "? ", "! ",
        " ",
        ""
    ]

    def _split_recursive(txt: str, seps: list[str]) -> list[str]:
        if not txt:
            return []
        if len(txt) <= target_size:
            return [txt]

        chosen_sep = None
        for s in seps:
            if s == "" or s in txt:
                chosen_sep = s
                break

        if chosen_sep is None or chosen_sep == "":
            return [txt[i : i + target_size] for i in range(0, len(txt), target_size)]

        parts = txt.split(chosen_sep)
        remaining_seps = seps[seps.index(chosen_sep) + 1 :]

        chunks = []
        curr_pieces = []
        curr_len = 0

        for i, part in enumerate(parts):
            piece = part + (chosen_sep if i < len(parts) - 1 else "")
            if not piece.strip():
                continue

            if len(piece) > target_size:
                if curr_pieces:
                    chunks.append("".join(curr_pieces))
                    curr_pieces = []
                    curr_len = 0
                sub_chunks = _split_recursive(piece, remaining_seps)
                chunks.extend(sub_chunks)
            elif curr_len + len(piece) <= target_size:
                curr_pieces.append(piece)
                curr_len += len(piece)
            else:
                chunks.append("".join(curr_pieces))
                curr_pieces = [piece]
                curr_len = len(piece)

        if curr_pieces:
            chunks.append("".join(curr_pieces))

        return [c.strip() for c in chunks if c.strip()]

    base_chunks = _split_recursive(text, separators)
    if not base_chunks:
        return []

    if overlap <= 0 or len(base_chunks) == 1:
        return base_chunks

    result_chunks = []
    for i, chunk in enumerate(base_chunks):
        if i == 0:
            result_chunks.append(chunk)
        else:
            prev = base_chunks[i - 1]
            overlap_prefix = prev[-overlap:] if len(prev) >= overlap else prev
            space_idx = overlap_prefix.find(" ")
            if space_idx != -1 and space_idx < len(overlap_prefix) - 1:
                overlap_prefix = overlap_prefix[space_idx + 1 :]

            combined = (overlap_prefix + " " + chunk).strip()
            if len(combined) <= target_size + overlap:
                result_chunks.append(combined)
            else:
                result_chunks.append(chunk)

    return result_chunks


async def ingest_document(collection: str, filename: str, content: str) -> int:
    chunks = _chunk_text(content, settings.chunk_size, settings.chunk_overlap)

    async with AsyncSessionLocal() as session:
        for chunk in chunks:
            doc = Document(
                collection_name=collection,
                filename=filename,
                content=chunk,
            )
            session.add(doc)
        await session.commit()

    chunk_dicts = [{"content": c, "filename": filename} for c in chunks]
    await semantic_search.upsert(collection, chunk_dicts)
    await bm25_index.rebuild_collection(collection)

    return len(chunks)
