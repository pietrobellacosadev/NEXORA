"""
Endpoint de investigação conversacional.
Recebe uma pergunta sobre um município e retorna a análise dos três agentes.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agents.consolidator_agent import AgenteConsolidador
from app.agents.schemas import ResultadoConsolidado
from app.db.database import get_db

router = APIRouter(prefix="/investigar", tags=["investigação"])


class PedidoInvestigacao(BaseModel):
    codigo_ibge: str
    pergunta: str


@router.post("", response_model=ResultadoConsolidado)
async def investigar(pedido: PedidoInvestigacao) -> ResultadoConsolidado:
    """
    Aciona os três agentes (Mercado, Social e Consolidador) para investigar
    um município. Mercado e Social executam em paralelo.
    """
    # Busca o nome do município no banco
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT nome FROM municipios WHERE codigo_ibge = ?",
            (pedido.codigo_ibge,),
        )
    finally:
        await db.close()

    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"Município com código IBGE {pedido.codigo_ibge} não encontrado.",
        )

    nome_municipio = rows[0]["nome"]
    consolidador = AgenteConsolidador()

    return await consolidador.investigar(
        codigo_ibge=pedido.codigo_ibge,
        nome_municipio=nome_municipio,
        pergunta=pedido.pergunta,
    )
