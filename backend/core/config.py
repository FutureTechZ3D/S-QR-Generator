from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    app_name: str = "QRGenerator"
    app_version: str = "1.0.0"
    debug: bool = True

    # MongoDB
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db: str = "qrgenerator"

    # JWT
    secret_key: str = "qrgenerator-super-secret-key-change-in-prod-2026"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080  # 7 days

    # Storage
    qr_output_dir: Path = Path(__file__).parent.parent.parent / "qr_output"

    # CORS
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
    ]

    # Backend base URL (used for dynamic QR redirect URLs)
    backend_base_url: str = "http://localhost:8001"

    class Config:
        env_file = ".env"

settings = Settings()
settings.qr_output_dir.mkdir(parents=True, exist_ok=True)
