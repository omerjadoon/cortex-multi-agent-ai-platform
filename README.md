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

- **Hybrid RAG** - Non-blocking BM25 + Qdrant semantic search with parallel multi-collection queries and Reciprocal Rank Fusion
- **ReAct Code Agent** - Plan > Generate > Validate > Test > Fix loop with Docker-isolated execution
- **Enterprise Multi-Tenancy** - Tenant ID data partitioning across Postgres entities, chat threads, and vector documents
- **Structured Audit Logging** - Enterprise JSON audit trails (`log_audit_event`) for SIEM integration (Splunk, Datadog)
- **Automated CI/CD Test Suite** - Comprehensive Pytest unit/security test suite and GitHub Actions workflow
- **Live Progress** - SSE-streamed step cards visible to the user in real time
- **Knowledge Base Management** - Admin can add, update, and delete documents per collection
- **Feedback Loop** - Users rate any chat response with thumbs up/down; admin reviews, edits, and promotes Q&A pairs into the knowledge base with one click
- **Role-Based Access** - Admin / Developer / Viewer with per-user collection scoping
- **Langfuse Monitoring** - Optional LLM observability (gracefully disabled if keys absent)
- **Next.js 14 Frontend** - App Router, Tailwind CSS, Zustand state, dark theme

---

## Quick Start (Full Docker Mode with Hot-Reloading)

### 1. Configure Environment

```bash
git clone <repo-url>
cd cortex
cp .env.example .env      # then edit with your keys
```

Set your `GROQ_API_KEY` inside `.env`.

### 2. Launch Entire Full-Stack with 1 Command

```bash
docker compose up --build
```

That's it! `docker-compose.yml` automatically spins up:
- 🐘 **PostgreSQL**: `localhost:5432`
- 🎯 **Qdrant Vector DB**: `localhost:6333`
- ⚡ **FastAPI Backend (with Hot-Reloading)**: `localhost:8000`
- 🌐 **Next.js Frontend (with Hot-Reloading)**: `localhost:3000`

> 💡 **Live Code Mounting**: Codebase directories (`./backend` and `./frontend`) are mounted live into the containers. Any edits you save in your local editor trigger instant hot-reloading inside the containers!

---

## Docker Code Sandbox

Generated code is never executed by the backend process. Build the dedicated, credential-free sandbox image once:

```bash
docker build -t openmind-sandbox:latest -f backend/sandbox/Dockerfile backend/sandbox
```

When the backend runs directly on your host, it will use that image automatically. For the Compose development stack, enable the opt-in Docker client socket override:

```bash
docker compose -f docker-compose.yml -f docker-compose.sandbox.yml up --build
```

Each test run gets a fresh container with no network, a read-only filesystem and input mount, no Linux capabilities, a non-root user, a 64-process limit, 256 MB RAM, 0.5 CPU, and a 30-second timeout. The API transfers generated files through the Docker API into a unique ephemeral volume, which the sandbox receives read-only and removes afterwards. Docker being unavailable is a failure: the application deliberately does not fall back to running generated code on the host.

The override mounts the host Docker socket for local development. In production, use a dedicated Docker daemon with narrowly scoped access rather than mounting the host socket into the API container.

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

## High-Performance Distributed Search

Cortex uses an asynchronous, parallel search pipeline designed for low latency across multi-collection environments:

- **Parallel Vector Queries**: Multi-collection Qdrant vector queries run concurrently using `asyncio.gather()`, maintaining $O(1)$ search latency regardless of collection count.
- **Non-Blocking Embeddings**: Heavy SentenceTransformer CPU vector calculations are offloaded to background threads using `asyncio.to_thread()`, keeping FastAPI's main event loop free.
- **Parallel Hybrid RRF**: BM25 keyword search and Qdrant semantic vector search execute in parallel before Reciprocal Rank Fusion scoring.

---

## Enterprise Multi-Tenancy & Governance

- **Tenant Isolation (`tenant_id`)**: Data entities (`User`, `Document`, `Feedback`, `ChatThread`) carry explicit tenant identifiers to ensure strict organization-level isolation.
- **Structured Audit Logging**: Security-relevant events (logins, RBAC modifications, document ingestions, code executions) generate structured JSON audit logs (`AUDIT_LOG`) ready for SIEM systems.
- **SSO / OIDC Ready**: Configurable parameters (`sso_enabled`, `oidc_issuer_url`, `oidc_client_id`) for Okta, Azure AD, and Auth0 integration.

---

## Security & Guardrails

Cortex implements a multi-layered security architecture designed to protect host infrastructure and LLM agent pipelines:

### 1. Authentication & Access Control
- **JWT Tokens (`HS256`)**: Standard bearer token authentication with configurable TTL (`JWT_EXPIRE_MINUTES`) and tenant context (`tenant_id`).
- **Role-Based Access Control (RBAC)**: Enforces `admin`, `developer`, and `viewer` role privileges.
  - Viewers are barred from initiating code generation requests.
  - Knowledge base management and ingestion endpoints require `admin` authorization.
- **Tenant Data Scoping**: Non-admin users are restricted to searching only documents within their assigned collections and tenant.

### 2. NeMo Guardrails & Async Injection Defense
- **NeMo Guardrails Integration (`backend/security/guardrails/`)**: Configured with Colang flow rules (`bot_rails.co`) and YAML rails (`config.yml`).
- **Async Non-Blocking Guardrails**: LLM-based security checks run asynchronously (`await evaluator.ainvoke`) without blocking the event loop.
- **Multi-Tiered Injection Detection**:
  - **Heuristic Regex Scanning**: Instantly detects signature patterns (e.g. `ignore previous instructions`, `DAN mode`, system prompt overrides, prompt extraction).
  - **NeMo Guardrails Engine / LLM Evaluator**: Evaluates prompts for jailbreaks and instruction manipulation before passing control to the router agent.
  - **Automated Refusal**: Flagged requests are blocked at step zero with an explicit security alert step event.

### 3. Docker-Isolated Code Execution
- **AST Static Validation (`validator.py`)**: Generated Python code is parsed into AST nodes to detect forbidden builtins (`eval`, `exec`, `compile`, `__import__`), calls (`os.system`, `os.popen`, `sys.exit`), and imports (`subprocess`, `socket`, `ctypes`, `pickle`, `shutil`).
- **Container Hardening (`executor.py`)**: Every run uses a fresh non-root Docker container with no network, a read-only root filesystem, dropped Linux capabilities, `no-new-privileges`, PID, CPU, memory, and wall-clock limits.
- **Credential-Free Inputs**: Only a read-only temporary directory containing the generated script and tests is mounted; the backend environment, source tree, and Docker socket are never mounted into the sandbox container.
- **Fail Closed**: If Docker is unavailable, generated code is not executed rather than falling back to the host.

---

## Testing & CI/CD

Run the automated Pytest unit and security integration suite:

```bash
# Run test suite locally
pytest tests/ -v
```

CI/CD is automated via GitHub Actions (`.github/workflows/ci.yml`) running containerized PostgreSQL and Qdrant services on every push and pull request.

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

