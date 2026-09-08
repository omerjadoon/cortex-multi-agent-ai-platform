# Deliberately separate from the API image: this image contains no application
# source, credentials, package-manager cache, or Docker client.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HOME=/tmp

# Runtime packages supported by the generated-code validator. Versions are capped
# to retain compatible wheels on Python 3.11 while allowing security-only rebuilds.
RUN pip install --no-cache-dir \
    "pytest>=8.2,<9" \
    "requests>=2.31,<3" \
    "numpy>=1.26,<3" \
    "pandas>=2.1,<3" \
    "matplotlib>=3.8,<4" \
    "seaborn>=0.13,<1" \
    "scikit-learn>=1.4,<2" \
    "scipy>=1.11,<2" \
    "pillow>=10,<12"

# The executor also supplies this identity explicitly. Keeping it in the image
# makes the safe default visible when the image is run manually.
USER 65534:65534
WORKDIR /sandbox
