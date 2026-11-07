"""
Endpoint de validação das credenciais e modelos GroqCloud.
Não executa inferência — apenas autentica e lista modelos disponíveis.
"""
import asyncio
from fastapi import APIRouter
from pydantic import BaseModel

from app.services.groq_client import make_client, GroqClient
from app.config import settings

router = APIRouter(prefix="/groq", tags=["groqcloud"])

AGENTES = ["market", "social", "consolidator"]


class ResultadoAgente(BaseModel):
    agente: str
    ok: bool
    modelo_configurado: str
    modelo_disponivel: bool
    chave_configurada: bool
    erro: str | None = None


class RespostaValidacao(BaseModel):
    todos_ok: bool
    agentes: list[ResultadoAgente]


@router.get("/validar", response_model=RespostaValidacao)
async def validar_credenciais() -> RespostaValidacao:
    """
    Valida credenciais e disponibilidade de modelos para os três agentes.
    Usa GET /models da GroqCloud — sem consumir tokens de inferência.
    """
    async def checar(agent: str) -> ResultadoAgente:
        modelo = settings.groq_model_for(agent)
        try:
            client: GroqClient = make_client(agent)
            resultado = await client.validar_credencial()
            return ResultadoAgente(
                agente=agent,
                ok=resultado.get("ok", False),
                modelo_configurado=modelo,
                modelo_disponivel=resultado.get("modelo_disponivel", False),
                chave_configurada=client.key_configured,
                erro=resultado.get("erro"),
            )
        except ValueError as exc:
            # Chave não configurada
            return ResultadoAgente(
                agente=agent,
                ok=False,
                modelo_configurado=modelo,
                modelo_disponivel=False,
                chave_configurada=False,
                erro=str(exc),
            )

    # Valida os três agentes em paralelo (economiza tempo, não consome tokens)
    resultados = await asyncio.gather(*[checar(a) for a in AGENTES])
    agentes_list = list(resultados)

    return RespostaValidacao(
        todos_ok=all(r.ok for r in agentes_list),
        agentes=agentes_list,
    )
