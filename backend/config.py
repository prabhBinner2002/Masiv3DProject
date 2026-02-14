import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///app.db")

    HEIGHT_DATA = os.getenv("HEIGHT_DATA", "cchr-krqg")
    ROOF_FOOTPRINTS_DATA = os.getenv("ROOF_FOOTPRINTS_DATA", "uc4c-6kbd")
    # Optional: Calgary Land Use District dataset for zoning (e.g. ckwt-snq8). If set, zoning is fetched from this API.
    ZONING_DATASET = os.getenv("ZONING_DATASET", "").strip() or None
    DATASET_LIMIT = int(os.getenv("DATASET_LIMIT", "70"))
    DATASET_TOKEN = os.getenv("DATASET_API", "")

    # Downtown Calgary bbox (lat/lng). Calgary API returns 1000 rows; we filter in Python.
    DOWNTOWN_TOP = float(os.getenv("DOWNTOWN_TOP", "51.058"))
    DOWNTOWN_BOTTOM = float(os.getenv("DOWNTOWN_BOTTOM", "51.038"))
    DOWNTOWN_LEFT = float(os.getenv("DOWNTOWN_LEFT", "-114.12"))
    DOWNTOWN_RIGHT = float(os.getenv("DOWNTOWN_RIGHT", "-114.04"))

    # Hugging Face Inference API (free tier); .env: HF_API_TOKEN or HUGGINGFACE_API_TOKEN
    HF_API_TOKEN = os.getenv("HF_API_TOKEN") or os.getenv("HUGGINGFACE_API_TOKEN") or os.getenv("HUGGINGFACE_API_KEY")
    # Use a model that works on HF serverless; Mistral-7B returned 410 Gone
    HUGGINGFACE_MODEL = os.getenv(
        "HUGGINGFACE_MODEL",
        "google/flan-t5-large",
    )
