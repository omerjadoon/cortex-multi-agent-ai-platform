<p align="center">
  <img src="screenshots/cortex_logo.png" alt="Cortex Logo" width="450" />
</p>

# Cortex - Multi-Agent AI Platform

A full-stack multi-agent AI system built with LangGraph, FastAPI, and Next.js.
Supports hybrid knowledge base search, ReAct-pattern code generation, role-based
access control, and live progress streaming.

![Cortex Application Interface](screenshots/screenshot%201.png)

---

## Features

- **Hybrid RAG** - BM25 + Qdrant semantic search with Reciprocal Rank Fusion
- **ReAct Code Agent** - Plan > Generate > Validate > Test > Fix loop with sandboxed execution
- **Live Progress** - SSE-streamed step cards visible to the user in real time
- **Knowledge Base Management** - Admin can add, update, and delete documents per collection
- **Feedback Loop** - Users rate any chat response with thumbs up/down; admin reviews, edits, and promotes Q&A pairs into the knowledge base with one click
- **Role-Based Access** - Admin / Developer / Viewer with per-user collection scoping
- **Langfuse Monitoring** - Optional LLM observability (gracefully disabled if keys absent)
- **Next.js 14 Frontend** - App Router, Tailwind CSS, Zustand state, dark theme

---

## Quick Start

### 1. Clone and configure

git clone <repo-url>
cd cortex
cp .env.example .env      # then edit with your keys

Minimum required in .env:

GROQ_API_KEY=gsk_...
JWT_SECRET=<random-secret>
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/cortex
QDRANT_URL=http://localhost:6333
NEXT_PUBLIC_API_URL=http://localhost:8000

### 2. Start infrastructure

docker compose up -d postgres qdrant

### 3. Backend

cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scriptsctivate
pip install -r requirements.txt
alembic upgrade head
uvicorn backend.main:app --reload --port 8000

### 4. Frontend

cd frontend
npm install
npm run dev

Open http://localhost:3000

---

## Services

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| Qdrant UI | http://localhost:6333/dashboard |
| Langfuse (optional) | http://localhost:3030 |

---

## Roles

| Role | Chat | Code Gen | KB Query | Admin Panel |
|------|------|----------|----------|-------------|
| admin | yes | yes | all collections | yes |
| developer | yes | yes | assigned collections | no |
| viewer | yes | no | assigned collections | no |

---

## Admin Panel

Navigate to /admin (admin accounts only):

- **Feedback** (default tab) - Review user-submitted thumbs up/down ratings on chat responses. Edit the question or answer inline, pick a target collection, and click "Add to KB" to ingest the Q&A pair as a knowledge base document. Filter by pending / ingested / dismissed.
- **Knowledge Base** - Select a collection, view all ingested documents (filename + chunk count), delete or update individual documents inline
- **Ingest** - Upload .txt or .md files into any collection
- **Users** - View all users, roles, and edit per-user allowed collections

---

## Feedback Loop

Users see thumbs up / thumbs down buttons below every assistant message in the chat.

- **Thumbs up** - marks the response as a good example and sends it to admin
- **Thumbs down** - marks the response as a bad example and sends it to admin

Both ratings appear in the admin **Feedback** tab with the original question and answer editable before ingestion. Admin can:

1. Edit the Q&A to correct or improve it
2. Select a target collection
3. Click **Add to KB** - the pair is chunked and indexed into the knowledge base immediately
4. Or click **Dismiss** to discard it

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| GROQ_API_KEY | (required) | Groq API key for LLM |
| DATABASE_URL | postgresql+asyncpg://... | Postgres connection |
| QDRANT_URL | http://localhost:6333 | Qdrant instance |
| JWT_SECRET | changeme | JWT signing secret |
| JWT_EXPIRE_MINUTES | 1440 | Token TTL (24h) |
| LANGFUSE_SECRET_KEY | (optional) | Langfuse monitoring |
| LANGFUSE_PUBLIC_KEY | (optional) | Langfuse monitoring |
| NEXT_PUBLIC_API_URL | http://localhost:8000 | Frontend backend URL |
| EMBEDDING_MODEL | all-MiniLM-L6-v2 | Sentence transformer model |

---

## Security & Guardrails

Cortex implements a multi-layered security architecture designed to protect both the host application and the LLM agent pipeline:

### 1. Authentication & Access Control
- **JWT Tokens (`HS256`)**: Standard bearer token authentication with configurable TTL (`JWT_EXPIRE_MINUTES`).
- **Role-Based Access Control (RBAC)**: Enforces `admin`, `developer`, and `viewer` role privileges.
  - Viewers are barred from initiating code generation requests.
  - Knowledge base management and ingestion endpoints require `admin` authorization.
- **Tenant Data Scoping**: Non-admin users are restricted to searching only documents within their explicitly assigned `allowed_collections`.

### 2. NeMo Guardrails & Prompt Injection Protection
- **NeMo Guardrails Integration (`backend/security/guardrails/`)**: Configured with Colang flow rules (`bot_rails.co`) and YAML rails (`config.yml`) to evaluate incoming prompts.
- **Entry-Point State Graph Checking (`guardrail_check`)**: A mandatory security node sits at the entry point of the LangGraph execution graph.
- **Multi-Tiered Injection Detection**:
  - **Heuristic Regex Scanning**: Instantly detects signature patterns (e.g. `ignore previous instructions`, `you are now in DAN mode`, system prompt overrides).
  - **NeMo Guardrails Engine / LLM Evaluator**: Evaluates prompts for jailbreaks, prompt extraction, and malicious instruction manipulation before passing control to the router agent.
  - **Automated Refusal**: Flagged requests are blocked at step zero with an explicit security alert step event.

### 3. Sandboxed Code Execution
- **AST Static Validation (`validator.py`)**: Generated Python code is parsed into AST nodes to detect forbidden calls (`os.system`, `__import__`) and restricted imports (`subprocess`).
- **Transient Workspaces & Timeouts (`executor.py`)**: Pytest code execution occurs in isolated temporary directories (`tempfile.TemporaryDirectory()`) with strict execution time limits.

---

## Evaluation

Cortex includes an automated evaluation suite powered by [DeepEval](https://github.com/confident-ai/deepeval) using Groq as the evaluation judge.

```bash
# Run all evaluation suites
python backend/evaluation/run_eval.py

# Or run a specific evaluation suite (e.g. rag, codegen, or router)
python backend/evaluation/run_eval.py --suite rag
```

---

## License

MIT

