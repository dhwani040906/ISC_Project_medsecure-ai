from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str
    frontend_origin: str = "http://localhost:5173"
    jwt_secret: str
    jwt_issuer: str = "medsecure-ai"
    access_token_minutes: int = 30
    image_storage_dir: str = "../storage/encrypted_images"
    image_private_key_path: str = "../storage/keys/image_wrapping_private.pem"
    image_public_key_path: str = "../storage/keys/image_wrapping_public.pem"
    report_storage_dir: str = "../storage/reports"
    report_signing_private_key_path: str = "../storage/keys/report_signing_private.pem"
    report_signing_public_key_path: str = "../storage/keys/report_signing_public.pem"
    pneumonia_model_path: str = "../ml/models/densenet121_pneumonia.pt"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if len(settings.jwt_secret) < 32:
        raise ValueError("JWT_SECRET must be at least 32 characters")
    return settings
