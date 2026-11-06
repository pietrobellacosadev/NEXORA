"""
Cliente HTTP para a API GroqCloud.
Responsável por autenticação, tratamento de erros, rate-limit e timeouts.
Nunca expõe chaves nos logs ou nas respostas.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

GROQ_BASE_URL = "https://api.groq.com/openai/v1"

# Mensagens de erro públicas — sem revelar chaves ou detalhes internos
_ERROS = {
    401: "Credencial GroqCloud inválida ou expirada para o agente '{agent}'. Gere uma nova chave em console.groq.com.",
    403: "Acesso negado pela GroqCloud para o agente '{agent}'.",
    404: "Modelo GroqCloud não encontrado para o agente '{agent}'. Verifique GROQ_MODEL_MARKET/SOCIAL/CONSOLIDATOR no .env ou acesse GET /api/groq/validar para listar os modelos disponíveis.",
    429: "Limite de requisições GroqCloud atingido. Aguarde alguns instantes.",
    500: "Erro interno na GroqCloud. Tente novamente em instantes.",
    503: "GroqCloud indisponível temporariamente.",
}


class GroqError(Exception):
    """Erro público do cliente GroqCloud (sem credenciais nos atributos)."""

    def __init__(self, mensagem: str, status_code: int | None = None):
        super().__init__(mensagem)
        self.status_code = status_code


class GroqClient:
    """
    Cliente assíncrono para a API GroqCloud.
    Cada instância é vinculada a um agente específico.
    """

    def __init__(self, agent: str) -> None:
        self._agent = agent
        self._key = settings.groq_key_for(agent)   # lança ValueError se ausente
        self._model = settings.groq_model_for(agent)
        self._max_tokens = settings.groq_max_tokens
        self._timeout = settings.groq_timeout_seconds
        self._max_retries = settings.groq_max_retries

    # ── Propriedades públicas seguras ──────────────────────────────────────
    @property
    def agent(self) -> str:
        return self._agent

    @property
    def model(self) -> str:
        return self._model

    @property
    def key_configured(self) -> bool:
        return bool(self._key)

    # ── Requisição base ────────────────────────────────────────────────────
    async def _post(self, endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Executa POST com retry em 429 e tratamento de erros."""
        headers = {
            "Authorization": f"Bearer {self._key}",
            "Content-Type": "application/json",
        }
        url = f"{GROQ_BASE_URL}{endpoint}"
        tentativa = 0

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            while tentativa <= self._max_retries:
                try:
                    resp = await client.post(url, json=payload, headers=headers)

                    if resp.status_code == 429:
                        raw_ra = resp.headers.get("retry-after", "")
                        try:
                            retry_after = int(raw_ra)
                        except (ValueError, TypeError):
                            retry_after = 20
                        # Retenta se ainda há tentativas disponíveis (sem limite de wait)
                        if tentativa < self._max_retries:
                            wait = min(retry_after, 60)  # aguarda no máximo 60s por tentativa
                            logger.warning(
                                "GroqCloud rate-limit (agente=%s, tentativa=%d/%d). Aguardando %ds.",
                                self._agent, tentativa + 1, self._max_retries, wait,
                            )
                            await asyncio.sleep(wait)
                            tentativa += 1
                            continue
                        raise GroqError(_ERROS[429], status_code=429)

                    if resp.status_code != 200:
                        msg = _ERROS.get(
                            resp.status_code,
                            f"Erro HTTP {resp.status_code} na GroqCloud.",
                        ).format(agent=self._agent)
                        raise GroqError(msg, status_code=resp.status_code)

                    return resp.json()

                except httpx.TimeoutException:
                    if tentativa < self._max_retries:
                        tentativa += 1
                        await asyncio.sleep(2)
                        continue
                    raise GroqError(
                        f"Timeout ao contactar a GroqCloud (agente={self._agent})."
                    )
                except httpx.RequestError as exc:
                    raise GroqError(
                        f"Falha de comunicação com a GroqCloud (agente={self._agent})."
                    ) from exc

        raise GroqError("Número máximo de tentativas atingido.")

    # ── Chat Completions ───────────────────────────────────────────────────
    async def chat(
        self,
        messages: list[dict[str, str]],
        max_tokens: int | None = None,
        temperature: float = 0.2,
        json_mode: bool = False,
        return_usage: bool = False,
    ) -> str | tuple[str, int | None]:
        """
        Envia mensagens ao modelo e retorna o texto da resposta.
        Lança GroqError em caso de falha.

        Quando json_mode=True, ativa response_format={"type":"json_object"},
        garantindo que o modelo só emita JSON válido e completo.

        Quando return_usage=True, retorna (conteúdo, tokens_totais) em vez de
        apenas o conteúdo, permitindo contabilizar o uso de tokens do agente.
        """
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "max_tokens": max_tokens or self._max_tokens,
            "temperature": temperature,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        data = await self._post("/chat/completions", payload)
        try:
            content = data["choices"][0]["message"]["content"]
            if return_usage:
                tokens = data.get("usage", {}).get("total_tokens")
                return content, tokens
            return content
        except (KeyError, IndexError) as exc:
            raise GroqError("Resposta inesperada da GroqCloud.") from exc

    # ── Validação de credencial (usa endpoint /models — sem consumir tokens) ─
    async def validar_credencial(self) -> dict[str, Any]:
        """
        Verifica autenticação e disponibilidade do modelo configurado.
        Usa GET /models — não gera tokens nem cobra créditos de inferência.
        """
        headers = {"Authorization": f"Bearer {self._key}"}
        url = f"{GROQ_BASE_URL}/models"

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url, headers=headers)

            if resp.status_code == 401:
                return {"ok": False, "erro": _ERROS[401].format(agent=self._agent)}
            if resp.status_code == 429:
                return {"ok": False, "erro": _ERROS[429]}
            if resp.status_code != 200:
                return {
                    "ok": False,
                    "erro": f"HTTP {resp.status_code} ao validar agente '{self._agent}'.",
                }

            modelos_disponiveis = [m["id"] for m in resp.json().get("data", [])]
            modelo_ok = self._model in modelos_disponiveis

            return {
                "ok": modelo_ok,
                "agente": self._agent,
                "modelo_configurado": self._model,
                "modelo_disponivel": modelo_ok,
                "modelos_disponiveis": modelos_disponiveis,
                "erro": None if modelo_ok else (
                    f"Modelo '{self._model}' não encontrado na conta GroqCloud. "
                    f"Disponíveis: {', '.join(modelos_disponiveis[:5])}…"
                ),
            }

        except httpx.TimeoutException:
            return {"ok": False, "erro": f"Timeout ao validar agente '{self._agent}'."}
        except httpx.RequestError:
            return {"ok": False, "erro": f"Falha de rede ao validar agente '{self._agent}'."}


def make_client(agent: str) -> GroqClient:
    """Factory para criar um GroqClient para o agente informado."""
    return GroqClient(agent)
