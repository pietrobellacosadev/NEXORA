from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


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
    app_reload: bool = Field(default=True)

    # ── Banco de dados ────────────────────────────────────────────────────────
    db_path: str = Field(default="./nexora.db")

    # ── CORS ──────────────────────────────────────────────────────────────────
    cors_origin: str = Field(default="http://localhost:5173")

    # ── GroqCloud — chave compartilhada (fallback) ────────────────────────────
    groq_api_key: str = Field(default="")

    # ── GroqCloud — chaves específicas por agente (opcionais) ────────────────
    groq_api_key_market: str = Field(default="")
    groq_api_key_social: str = Field(default="")
    groq_api_key_consolidator: str = Field(default="")

    # ── GroqCloud — modelos por agente ────────────────────────────────────────
    # llama-3.3-70b-versatile: raciocínio avançado, melhor para consolidação
    # llama-3.1-8b-instant: rápido e econômico, adequado para coleta de dados
    groq_model_market: str = Field(default="llama-3.1-8b-instant")
    groq_model_social: str = Field(default="llama-3.1-8b-instant")
    groq_model_consolidator: str = Field(default="llama-3.3-70b-versatile")

    # ── GroqCloud — limites de consumo ────────────────────────────────────────
    groq_max_tokens: int = Field(default=2048)
    groq_timeout_seconds: int = Field(default=30)
    groq_max_retries: int = Field(default=2)

    def groq_key_for(self, agent: str) -> str:
        """
        Retorna a chave GroqCloud correta para o agente informado.
        Prioridade: chave específica do agente > chave compartilhada.
        Lança ValueError se nenhuma chave estiver configurada.
        """
        specific = {
            "market":      self.groq_api_key_market,
            "social":      self.groq_api_key_social,
            "consolidator": self.groq_api_key_consolidator,
        }.get(agent, "")

        key = specific or self.groq_api_key

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
            "market":      self.groq_model_market,
            "social":      self.groq_model_social,
            "consolidator": self.groq_model_consolidator,
        }.get(agent, self.groq_model_consolidator)


settings = Settings()
