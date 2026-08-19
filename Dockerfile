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

# Define the entrypoint to the new cloud wrapper
ENTRYPOINT ["python", "/app/core/cloud_extractor.py"]
ENV PYTHONUNBUFFERED=1