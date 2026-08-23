FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Add GCP Storage library since it's needed for the cloud wrapper
RUN pip install --no-cache-dir google-cloud-storage

# Copy the core directory into /app/core
COPY core/ /app/core/

# Define the entrypoint to a shell script that checks the MODE env var
# If MODE=recorrect, run Phase 2. Otherwise run Phase 1 (cloud_extractor.py)
ENTRYPOINT ["/bin/sh", "-c", "if [ \"$MODE\" = \"recorrect\" ]; then python /app/core/cloud_recorrection.py; else python /app/core/cloud_extractor.py; fi"]
ENV PYTHONUNBUFFERED=1