FROM docker:27-cli AS docker-cli

FROM python:3.11-slim

# Prevent Python from writing .pyc files & enable unbuffered stdout/stderr logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies (build tools & postgres client libraries)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libpq-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for Docker layer caching
COPY requirements.txt .
RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir pytest pytest-asyncio

# Only the Docker client is present; it talks to a configured daemon/socket.
# Keeping this after dependency installation preserves the expensive dependency
# layer when the Docker CLI version changes.
# Generated code never receives that socket or this image's filesystem.
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker

# Copy application source code
COPY backend ./backend
COPY tests ./tests

EXPOSE 8000

# Launch Uvicorn with hot reload enabled (SQLAlchemy Base.metadata.create_all handles DB tables on lifespan startup)
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
