from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    app_env: str = Field(default="development")
    app_host: str = Field(default="127.0.0.1")
    app_port: int = Field(default=8000)
    app_reload: bool = Field(default=True)

    db_path: str = Field(default="./nexora.db")

    cors_origin: str = Field(default="http://localhost:5173")

    groq_api_key: str = Field(default="")


settings = Settings()
