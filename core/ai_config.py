import os
import itertools
from google import genai
import google.auth
from google.auth.exceptions import DefaultCredentialsError

# ==============================================================================
# CENTRALIZED AI CONFIGURATION & CLIENT FACTORY
# ==============================================================================
# 1. Model Configuration:
#    - Edit DEFAULT_MODEL below, OR set export GEMINI_MODEL="gemini-2.0-flash"
#
# 2. Free Google AI Studio Mode:
#    - Set export GEMINI_API_KEY="AIzaSy..."
#    - Supports multi-key rotation: export GEMINI_API_KEY="key1,key2,key3"
#    - Automatically scales workers to 2 per key to stay under 15 RPM free limit.
#
# 3. GCP Vertex AI Mode (Default):
#    - Used automatically when GEMINI_API_KEY is not set.
# ==============================================================================

DEFAULT_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

# Key rotator for multiple AI Studio free keys
_key_cycle = None

def get_model_name() -> str:
    """Returns the active Gemini model name across all extractors."""
    return os.environ.get("GEMINI_MODEL", DEFAULT_MODEL)

def is_ai_studio_mode() -> bool:
    """Returns True if running via Google AI Studio API key."""
    return bool(os.environ.get("GEMINI_API_KEY"))

def get_api_keys() -> list:
    """Returns list of API keys from GEMINI_API_KEY (supports comma-separated list)."""
    raw_keys = os.environ.get("GEMINI_API_KEY", "").strip()
    if not raw_keys:
        return []
    return [k.strip() for k in raw_keys.split(",") if k.strip()]

def get_recommended_workers() -> int:
    """
    Returns safe worker count:
    - AI Studio Free Tier has strict 15 RPM limit -> uses 2 workers per key (max 6).
    - Vertex AI has enterprise quota -> uses 5 workers.
    """
    if is_ai_studio_mode():
        keys = get_api_keys()
        key_count = max(1, len(keys))
        # 2 workers per key (each page ~12s = ~10 RPM per key, well below 15 RPM limit)
        recommended = min(key_count * 2, 6)
        return int(os.environ.get("MAX_WORKERS", recommended))
    return int(os.environ.get("MAX_WORKERS", 5))

def get_genai_client():
    """
    Returns a configured Google GenAI client.
    - If GEMINI_API_KEY is set, connects to Google AI Studio (with multi-key rotation if provided).
    - Otherwise, falls back to Google Cloud Vertex AI using default credentials.
    """
    global _key_cycle
    keys = get_api_keys()
    
    if keys:
        if _key_cycle is None:
            _key_cycle = itertools.cycle(keys)
        active_key = next(_key_cycle)
        masked_key = active_key[:6] + "..." + active_key[-4:] if len(active_key) > 10 else "***"
        print(f"🤖 [AI Config] Using Google AI Studio (Key: {masked_key} | Total Keys: {len(keys)} | Model: {get_model_name()})")
        return genai.Client(api_key=active_key)
    
    try:
        credentials, project_id = google.auth.default()
        location = os.environ.get("VERTEX_LOCATION", "us-central1")
        print(f"☁️ [AI Config] Using GCP Vertex AI (Project: {project_id} | Location: {location} | Model: {get_model_name()})")
        return genai.Client(vertexai=True, project=project_id, location=location)
    except DefaultCredentialsError:
        print("❌ Error: Neither GEMINI_API_KEY nor GCP credentials found.")
        print("👉 To use Free Google AI Studio: export GEMINI_API_KEY='your-key'")
        print("👉 To use GCP Vertex AI: gcloud auth application-default login")
        raise
