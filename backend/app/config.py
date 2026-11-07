from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Aplicação ─────────────────────────────────────────────────────────────
    app_env: str = Field(default="development")
    app_host: str = Field(default="127.0.0.1")
    app_port: int = Field(default=8000)
    app_reload: bool = Field(default=False)

    # ── Banco de dados ────────────────────────────────────────────────────────
    db_path: str = Field(default="./nexora.db")

    # ── CORS ──────────────────────────────────────────────────────────────────
    cors_origin: str = Field(default="http://localhost:5173")

    # ── GroqCloud — chave compartilhada (fallback) ────────────────────────────
    # SecretStr: nunca exposta em __repr__, logs ou serialização padrão
    groq_api_key: SecretStr = Field(default=SecretStr(""))

    # ── GroqCloud — chaves específicas por agente (opcionais) ────────────────
    groq_api_key_market: SecretStr = Field(default=SecretStr(""))
    groq_api_key_social: SecretStr = Field(default=SecretStr(""))
    groq_api_key_consolidator: SecretStr = Field(default=SecretStr(""))

    # ── GroqCloud — modelos por agente ────────────────────────────────────────
    # Modelos disponíveis nestas chaves (verificado 2026-11):
    #   qwen/qwen3.8-27b     — rápido, bom para especialistas (market/social)
    #   openai/gpt-oss-120b  — melhor qualidade, para consolidador
    # Override via GROQ_MODEL_MARKET / GROQ_MODEL_SOCIAL / GROQ_MODEL_CONSOLIDATOR no .env
    groq_model_market: str = Field(default="qwen/qwen3.8-27b")
    groq_model_social: str = Field(default="qwen/qwen3.8-27b")
    groq_model_consolidator: str = Field(default="openai/gpt-oss-120b")

    # ── GroqCloud — limites de consumo ────────────────────────────────────────
    groq_max_tokens: int = Field(default=4096)
    groq_timeout_seconds: int = Field(default=60)
    groq_max_retries: int = Field(default=2)

    def groq_key_for(self, agent: str) -> str:
        """
        Retorna o valor da chave GroqCloud para o agente.
        Prioridade: chave específica > chave compartilhada.
        Lança ValueError se nenhuma estiver configurada.
        O valor retornado é usado apenas internamente pelo GroqClient.
        """
        specific_secret = {
            "market":       self.groq_api_key_market,
            "social":       self.groq_api_key_social,
            "consolidator": self.groq_api_key_consolidator,
        }.get(agent)

        # .get_secret_value() extrai o valor do SecretStr
        specific = specific_secret.get_secret_value() if specific_secret else ""
        shared = self.groq_api_key.get_secret_value()

        key = specific or shared

        if not key:
            raise ValueError(
                f"Agente '{agent}' não possui credencial GroqCloud configurada. "
                "Defina GROQ_API_KEY (compartilhada) ou "
                f"GROQ_API_KEY_{agent.upper()} no arquivo .env."
            )
        return key

    def groq_model_for(self, agent: str) -> str:
        """Retorna o modelo GroqCloud configurado para o agente informado."""
        return {
            "market":       self.groq_model_market,
            "social":       self.groq_model_social,
            "consolidator": self.groq_model_consolidator,
        }.get(agent, self.groq_model_consolidator)


settings = Settings()
