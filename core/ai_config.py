import os
from google import genai
import google.auth
from google.auth.exceptions import DefaultCredentialsError

# ==============================================================================
# CENTRALIZED AI CONFIGURATION & CLIENT FACTORY
# ==============================================================================
# To change the model across the entire project in 1 place:
# 1. Edit DEFAULT_MODEL below, OR
# 2. Set environment variable: export GEMINI_MODEL="gemini-2.0-flash"
#
# To switch to Free Google AI Studio:
# 1. Set environment variable: export GEMINI_API_KEY="AIzaSy..."
# 2. The client will automatically connect to Google AI Studio instead of Vertex AI.
# ==============================================================================

DEFAULT_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

def get_model_name() -> str:
    """Returns the active Gemini model name across all extractors."""
    return os.environ.get("GEMINI_MODEL", DEFAULT_MODEL)

def get_genai_client():
    """
    Returns a configured Google GenAI client.
    
    1. Google AI Studio Mode (Free Tier API Key):
       If `GEMINI_API_KEY` is set in the environment or .env,
       it connects directly to Google AI Studio with zero GCP Vertex AI charges.
       
    2. GCP Vertex AI Mode (Default / ADC):
       If `GEMINI_API_KEY` is not set, it connects to Vertex AI using
       Google Cloud Application Default Credentials.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key:
        print(f"🤖 [AI Config] Using Google AI Studio (API Key | Model: {get_model_name()})")
        return genai.Client(api_key=api_key)
    
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
