from pydantic import field_validator
from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 8
    UPLOAD_DIR: str = "uploads"
    LOG_DIR: str = "logs"
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Gmail SMTP
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None       # tu correo Gmail
    SMTP_PASSWORD: Optional[str] = None   # contraseña de aplicación Gmail

    # CallMeBot WhatsApp
    CALLMEBOT_APIKEY: Optional[str] = None

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_must_be_strong(cls, v: str) -> str:
        if len(v) < 32 or "change-this" in v.lower():
            raise ValueError(
                "SECRET_KEY débil: usa al menos 32 caracteres y no el valor de ejemplo "
                "(genera uno con: python -c \"import secrets; print(secrets.token_urlsafe(48))\")"
            )
        return v

    class Config:
        env_file = ".env"
        extra = "ignore"  # DB_USER/DB_PASSWORD las usa solo Docker Compose


settings = Settings()
